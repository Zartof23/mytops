import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

// Topic-specific metadata schemas
export const TOPIC_SCHEMAS: Record<string, { fields: string[], required: string[] }> = {
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

export interface ExtractedData {
  found: boolean;
  confidence_score: number;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  image_url: string | null;
  sources: string[];
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
export async function extractItemData(
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
