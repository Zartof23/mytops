import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Topic-specific metadata schemas
const TOPIC_SCHEMAS: Record<string, { fields: string[], required: string[] }> = {
  movies: {
    fields: ["year", "director", "genre", "runtime", "cast"],
    required: ["year", "director", "genre"]
  },
  series: {
    fields: ["year", "seasons", "genre", "network", "cast"],
    required: ["year", "genre"]
  },
  books: {
    fields: ["author", "year", "genre", "pages", "isbn"],
    required: ["author", "year", "genre"]
  },
  anime: {
    fields: ["year", "studio", "genre", "episodes", "type"],
    required: ["year", "genre"]
  },
  games: {
    fields: ["year", "developer", "publisher", "genre", "platforms"],
    required: ["year", "developer", "genre"]
  },
  restaurants: {
    fields: ["cuisine", "location", "price_range", "style"],
    required: ["cuisine", "location"]
  }
};

interface EnrichmentRequest {
  topic_id: string;
  topic_slug: string;
  search_query: string;
}

interface ExtractedData {
  found: boolean;
  confidence_score: number;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  image_url: string | null;
  sources: string[];
}

// Helper: Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Check for existing item (fuzzy match)
async function checkExistingItem(
  supabase: any,
  topicId: string,
  searchQuery: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('topic_id', topicId)
    .ilike('name', `%${searchQuery}%`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking existing item:', error);
  }

  return data;
}

// Helper: Execute Tavily web search
async function executeWebSearch(
  query: string,
  searchType: 'general' | 'images' = 'general'
): Promise<string> {
  const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query: query,
      search_depth: 'basic',
      include_images: searchType === 'images',
      include_answer: true,
      max_results: 5
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 402 || response.status === 429 ||
        (errorData.error && (errorData.error.includes('insufficient') || errorData.error.includes('quota') || errorData.error.includes('limit')))) {
      throw new Error('OUT_OF_GAS');
    }

    throw new Error(`Tavily API error: ${response.statusText}`);
  }

  const data = await response.json();
  return JSON.stringify(data);
}

// Helper: Extract item data using Claude API with tool_use
async function extractItemData(
  searchQuery: string,
  topicSlug: string
): Promise<ExtractedData> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({
    apiKey: anthropicApiKey,
  });

  const schema = TOPIC_SCHEMAS[topicSlug];
  if (!schema) {
    throw new Error(`Unknown topic: ${topicSlug}`);
  }

  const systemPrompt = `You are a database enrichment assistant for mytops, a platform where users track their favorite ${topicSlug}.

Your task: Find accurate information about "${searchQuery}" and return structured data.

CRITICAL RULES:
1. Use the web_search tool to find information
2. Prefer official sources in this order: TMDB > IMDB > Wikipedia > Official sites
3. Only include data you are CONFIDENT about
4. Set confidence_score based on source reliability and data consistency (0.0 to 1.0)
5. For images, search specifically for official poster/cover images
6. Validate all data (year must be 4 digits, runtime in minutes, etc.)

TOPIC: ${topicSlug}
REQUIRED FIELDS: ${JSON.stringify(schema.fields)}

After searching, respond with this exact JSON structure:
{
  "found": boolean,
  "confidence_score": 0.0-1.0,
  "title": "Official title",
  "description": "2-3 sentence description",
  "metadata": {
    // Topic-specific fields from schema
  },
  "image_url": "Direct URL to poster/cover image or null",
  "sources": ["URLs used for verification"]
}

If you cannot find reliable information, set found: false and explain why in description.`;

  const tools: Anthropic.Tool[] = [
    {
      name: "web_search",
      description: "Search the web for information about movies, books, games, etc. Use this to find details like release year, director, cast, description, and poster images.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query. Be specific, include the item type (e.g., 'The Matrix 1999 movie')"
          },
          search_type: {
            type: "string",
            enum: ["general", "images"],
            description: "Type of search: 'general' for info, 'images' for poster/cover images"
          }
        },
        required: ["query"]
      }
    }
  ];

  let messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Find information about: ${searchQuery}`
    }
  ];

  let continueLoop = true;
  let iterations = 0;
  const maxIterations = 5;

  while (continueLoop && iterations < maxIterations) {
    iterations++;

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools,
        messages: messages,
      });

      console.log('Claude response:', JSON.stringify(response, null, 2));

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUses.length > 0) {
        // Claude 4.x can emit multiple parallel tool_use blocks in one turn.
        // Each one MUST be answered with a matching tool_result in the next user message.
        const toolResults = await Promise.all(
          toolUses.map(async (toolUse) => {
            const input = toolUse.input as { query: string; search_type?: string };
            try {
              const searchResults = await executeWebSearch(
                input.query,
                (input.search_type as 'general' | 'images') || 'general'
              );
              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: searchResults
              };
            } catch (err: any) {
              if (err.message === 'OUT_OF_GAS') throw err;
              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: `Search error: ${err.message}`,
                is_error: true
              };
            }
          })
        );

        messages.push({
          role: "assistant",
          content: response.content
        });

        messages.push({
          role: "user",
          content: toolResults
        });
      } else {
        continueLoop = false;

        const textBlock = response.content.find(
          (block) => block.type === "text"
        );

        if (!textBlock || textBlock.type !== "text") {
          throw new Error('No text response from Claude');
        }

        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }

        const extractedData: ExtractedData = JSON.parse(jsonMatch[0]);
        return extractedData;
      }
    } catch (error: any) {
      if (error.status === 402 || error.status === 429 ||
          (error.message && (error.message.includes('insufficient') || error.message.includes('quota') || error.message.includes('credits')))) {
        throw new Error('OUT_OF_GAS');
      }
      throw error;
    }
  }

  throw new Error('Max iterations reached without getting final answer');
}

// Helper: Download and store image (uses service role for storage)
async function downloadAndStoreImage(
  imageUrl: string,
  topicSlug: string,
  itemSlug: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to download image:', response.statusText);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const filePath = `${topicSlug}/${itemSlug}.webp`;
    const { data, error } = await supabaseServiceRole.storage
      .from('item-images')
      .upload(filePath, uint8Array, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) {
      console.error('Failed to upload image:', error);
      return null;
    }

    const { data: urlData } = supabaseServiceRole.storage
      .from('item-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in downloadAndStoreImage:', error);
    return null;
  }
}

// Helper: Validate input
function validateInput(body: EnrichmentRequest): string | null {
  if (!body.topic_id || typeof body.topic_id !== 'string') {
    return 'Missing or invalid topic_id';
  }
  if (!body.topic_slug || typeof body.topic_slug !== 'string') {
    return 'Missing or invalid topic_slug';
  }
  if (!body.search_query || typeof body.search_query !== 'string') {
    return 'Missing or invalid search_query';
  }
  if (body.search_query.length > 200) {
    return 'Search query too long (max 200 characters)';
  }
  if (!TOPIC_SCHEMAS[body.topic_slug]) {
    return `Unknown topic: ${body.topic_slug}`;
  }
  return null;
}

// Main handler
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Track the in-flight request row so the outer catch can mark it failed
  let inFlightRequestId: string | null = null;
  let supabaseForCleanup: any = null;

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    supabaseForCleanup = supabaseClient;

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: config } = await supabaseClient
      .from('app_config')
      .select('value')
      .eq('key', 'ai_enrichment_enabled')
      .single();

    if (!config?.value?.enabled) {
      return new Response(
        JSON.stringify({ error: 'AI enrichment is temporarily disabled' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rateLimit, error: rateLimitError } = await supabaseClient
      .rpc('check_enrichment_rate_limit', { p_user_id: user.id });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Failed to check rate limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rateLimit?.[0]?.can_request) {
      return new Response(
        JSON.stringify({
          error: `Slow down there, speed racer. You've hit your daily limit (${rateLimit[0].requests_today}/${rateLimit[0].daily_limit}). Try again tomorrow.`,
          requests_today: rateLimit[0].requests_today,
          daily_limit: rateLimit[0].daily_limit
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: EnrichmentRequest = await req.json();
    const validationError = validateInput(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingItem = await checkExistingItem(
      supabaseClient,
      body.topic_id,
      body.search_query
    );

    if (existingItem) {
      return new Response(
        JSON.stringify({
          status: 'existing',
          item: existingItem,
          message: 'Item already exists in database'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: request, error: requestError } = await supabaseClient
      .from('user_enrichment_requests')
      .insert({
        user_id: user.id,
        topic_id: body.topic_id,
        search_query: body.search_query,
        status: 'processing'
      })
      .select()
      .single();

    if (requestError) {
      console.error('Failed to create request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Failed to process request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    inFlightRequestId = request.id;

    const extractedData = await extractItemData(
      body.search_query,
      body.topic_slug
    );

    if (!extractedData.found || extractedData.confidence_score < 0.6) {
      await supabaseClient
        .from('user_enrichment_requests')
        .update({
          status: 'failed',
          error_message: 'Could not find reliable information',
          completed_at: new Date().toISOString()
        })
        .eq('id', request.id);
      inFlightRequestId = null;

      return new Response(
        JSON.stringify({
          error: "Couldn't find anything matching that search. Check for typos or try a more specific search."
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const itemSlug = generateSlug(extractedData.title);
    let storedImageUrl = null;

    if (extractedData.image_url) {
      storedImageUrl = await downloadAndStoreImage(
        extractedData.image_url,
        body.topic_slug,
        itemSlug
      );
    }

    const needsReview = extractedData.confidence_score < 0.8;

    const { data: newItem, error: insertError } = await supabaseClient
      .from('items')
      .insert({
        topic_id: body.topic_id,
        name: extractedData.title,
        slug: itemSlug,
        description: extractedData.description,
        metadata: extractedData.metadata,
        image_url: storedImageUrl,
        source: 'ai_generated',
        ai_confidence: extractedData.confidence_score,
        review_pending: needsReview,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert item:', insertError);
      await supabaseClient
        .from('user_enrichment_requests')
        .update({
          status: 'failed',
          error_message: insertError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', request.id);
      inFlightRequestId = null;

      return new Response(
        JSON.stringify({ error: 'Failed to save item' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseClient
      .from('user_enrichment_requests')
      .update({
        status: 'completed',
        result_item_id: newItem.id,
        completed_at: new Date().toISOString()
      })
      .eq('id', request.id);
    inFlightRequestId = null;

    return new Response(
      JSON.stringify({
        status: 'created',
        item: newItem,
        message: 'Item successfully added to database'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);

    // Mark the in-flight request as failed so it doesn't get stuck in "processing"
    if (inFlightRequestId && supabaseForCleanup) {
      try {
        await supabaseForCleanup
          .from('user_enrichment_requests')
          .update({
            status: 'failed',
            error_message: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)} (status=${error?.status ?? 'n/a'})`.slice(0, 1000),
            completed_at: new Date().toISOString()
          })
          .eq('id', inFlightRequestId);
      } catch (cleanupErr) {
        console.error('Failed to mark request as failed:', cleanupErr);
      }
    }

    if (error.message === 'OUT_OF_GAS') {
      return new Response(
        JSON.stringify({
          error: 'OUT_OF_GAS',
          errorType: 'insufficient_funds'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Something broke. Honestly, I'm surprised it worked this long."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
