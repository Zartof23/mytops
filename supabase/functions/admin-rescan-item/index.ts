import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateSlug } from "../_shared/slug.ts";
import { downloadAndStoreImage } from "../_shared/images.ts";
import { extractItemData, type ExtractedData } from "../_shared/extraction.ts";

interface ItemRow {
  id: string;
  topic_id: string;
  name: string;
  slug: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  image_url: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Flat comparison of current item vs. proposal. Metadata is compared per key
 * so an admin can accept one field without accepting the rest.
 */
function diffFields(current: ItemRow, proposed: ExtractedData): string[] {
  const changed: string[] = [];
  const norm = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');

  if (proposed.title && proposed.title !== current.name) changed.push('name');
  if (proposed.description && proposed.description !== current.description) changed.push('description');
  if (proposed.image_url && !current.image_url) changed.push('image_url');

  const currentMeta = current.metadata ?? {};
  for (const [key, value] of Object.entries(proposed.metadata ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    if (norm(value) !== norm(currentMeta[key])) changed.push(`metadata.${key}`);
  }
  return changed;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return json({ error: 'Authentication required' }, 401);

    // Authorization lives in the database, not here.
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin');
    if (adminError || !isAdmin) {
      return json({ error: 'Admin privileges required' }, 403);
    }

    const body = await req.json();
    const itemId = body?.item_id;
    if (typeof itemId !== 'string' || itemId.length === 0) {
      return json({ error: 'item_id is required' }, 400);
    }

    const { data: item, error: itemError } = await supabaseClient
      .from('items')
      .select('id, topic_id, name, slug, description, metadata, image_url, topic:topics(slug)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) return json({ error: 'Item not found' }, 404);

    const topicSlug = (item as { topic?: { slug?: string } }).topic?.slug;
    if (!topicSlug) return json({ error: 'Item has no topic' }, 400);

    // The proposal is always recomputed server-side. The client's copy is
    // never trusted for values — only for which fields to apply.
    const proposed = await extractItemData(item.name, topicSlug);

    if (!proposed.found || proposed.confidence_score < 0.6) {
      return json({
        error: "Couldn't find reliable information on this one. Nothing to propose."
      }, 404);
    }

    const changed = diffFields(item as unknown as ItemRow, proposed);
    const isApply = new URL(req.url).pathname.endsWith('/apply');

    if (!isApply) {
      return json({
        current: item,
        proposed: {
          name: proposed.title,
          description: proposed.description,
          metadata: proposed.metadata,
          image_url: proposed.image_url
        },
        changed_fields: changed,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      });
    }

    // --- apply ---
    const requested: string[] = Array.isArray(body.fields) ? body.fields : [];
    const selected = requested.filter((f) => changed.includes(f));
    if (selected.length === 0) {
      return json({ error: 'No applicable fields selected' }, 400);
    }

    const update: Record<string, unknown> = {};
    const nextMetadata = { ...(item.metadata ?? {}) };
    let metadataTouched = false;

    for (const field of selected) {
      if (field === 'name') {
        update.name = proposed.title;
        update.slug = generateSlug(proposed.title);
      } else if (field === 'description') {
        update.description = proposed.description;
      } else if (field === 'image_url') {
        const stored = await downloadAndStoreImage(
          proposed.image_url!, topicSlug, generateSlug(proposed.title)
        );
        if (stored) update.image_url = stored;
      } else if (field.startsWith('metadata.')) {
        const key = field.slice('metadata.'.length);
        nextMetadata[key] = proposed.metadata[key];
        metadataTouched = true;
      }
    }

    if (metadataTouched) update.metadata = nextMetadata;
    update.updated_at = new Date().toISOString();

    // Service role: items UPDATE is restricted to the creator by RLS, and an
    // admin is generally not the creator.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: updated, error: updateError } = await serviceClient
      .from('items')
      .update(update)
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to apply rescan:', updateError);
      return json({ error: 'Failed to update item' }, 500);
    }

    await serviceClient.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'apply_rescan',
      item_id: itemId,
      payload: {
        before: item,
        applied_fields: selected,
        after: updated,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      }
    });

    // Flag status is deliberately untouched — the admin resolves explicitly.
    return json({ item: updated });
  } catch (error) {
    console.error('Rescan failed:', error);
    return json({ error: 'Something broke. Honestly, surprised it worked this long.' }, 500);
  }
});
