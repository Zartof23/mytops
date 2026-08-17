import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateSlug } from "../_shared/slug.ts";
import { downloadAndStoreImage } from "../_shared/images.ts";
import { extractItemData, TOPIC_SCHEMAS } from "../_shared/extraction.ts";

interface EnrichmentRequest {
  topic_id: string;
  topic_slug: string;
  search_query: string;
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

    // user_enrichment_requests has no UPDATE policy for authenticated users by
    // design (an UPDATE policy would let users set their own rows to 'failed'
    // and reset their daily rate-limit quota). Status is server-managed state,
    // so status writes go through the service-role client instead.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    supabaseForCleanup = serviceClient;

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
      const { error: statusError } = await serviceClient
        .from('user_enrichment_requests')
        .update({
          status: 'failed',
          error_message: 'Could not find reliable information',
          completed_at: new Date().toISOString()
        })
        .eq('id', request.id);
      if (statusError) {
        console.error('Failed to mark request as failed:', statusError);
      }
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
      const { error: statusError } = await serviceClient
        .from('user_enrichment_requests')
        .update({
          status: 'failed',
          error_message: insertError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', request.id);
      if (statusError) {
        console.error('Failed to mark request as failed:', statusError);
      }
      inFlightRequestId = null;

      return new Response(
        JSON.stringify({ error: 'Failed to save item' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: completedStatusError } = await serviceClient
      .from('user_enrichment_requests')
      .update({
        status: 'completed',
        result_item_id: newItem.id,
        completed_at: new Date().toISOString()
      })
      .eq('id', request.id);
    if (completedStatusError) {
      console.error('Failed to mark request as completed:', completedStatusError);
    }
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
        const { error: cleanupStatusError } = await supabaseForCleanup
          .from('user_enrichment_requests')
          .update({
            status: 'failed',
            error_message: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)} (status=${error?.status ?? 'n/a'})`.slice(0, 1000),
            completed_at: new Date().toISOString()
          })
          .eq('id', inFlightRequestId);
        if (cleanupStatusError) {
          console.error('Failed to mark request as failed:', cleanupStatusError);
        }
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
