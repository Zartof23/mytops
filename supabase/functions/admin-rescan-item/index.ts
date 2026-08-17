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

interface ProposedData {
  name: string;
  description: string;
  metadata: Record<string, unknown>;
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
 *
 * Values are trimmed and objects are compared via JSON.stringify so a
 * capitalization fix (a real, intentional change) is still detected, while
 * whitespace-only noise and "[object Object]" false-negatives are not.
 */
function diffFields(current: ItemRow, proposed: ExtractedData): string[] {
  const changed: string[] = [];
  const norm = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.join(', ').trim();
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v).trim();
  };

  if (proposed.title && norm(proposed.title) !== norm(current.name)) changed.push('name');
  if (proposed.description && norm(proposed.description) !== norm(current.description)) changed.push('description');
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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Malformed request body' }, 400);
    }

    const isApply = new URL(req.url).pathname.endsWith('/apply');

    // Service role: item writes are restricted to the creator by RLS (an
    // admin generally isn't), and admin_rescan_proposals / admin_audit_log
    // have no write policies for authenticated users at all.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (isApply) {
      const proposalId = body?.proposal_id;
      if (typeof proposalId !== 'string' || proposalId.length === 0) {
        return json({ error: 'proposal_id is required' }, 400);
      }
      const requested: string[] = Array.isArray(body.fields) ? body.fields as string[] : [];

      const { data: proposal, error: proposalError } = await serviceClient
        .from('admin_rescan_proposals')
        .select('*')
        .eq('id', proposalId)
        .maybeSingle();

      if (proposalError || !proposal) return json({ error: 'Proposal not found' }, 404);

      if (new Date(proposal.expires_at as string).getTime() < Date.now()) {
        return json({ error: 'That proposal expired — re-scan and review again' }, 410);
      }

      // item_id comes from the stored proposal, never the request body, so a
      // client cannot point a proposal at a different item.
      const itemId = proposal.item_id as string;

      const { data: item, error: itemError } = await serviceClient
        .from('items')
        .select('id, topic_id, name, slug, description, metadata, image_url, topic:topics(slug)')
        .eq('id', itemId)
        .single();

      if (itemError || !item) return json({ error: 'Item not found' }, 404);

      const topicSlug = (item as { topic?: { slug?: string } }).topic?.slug;
      const proposed = proposal.proposed as ProposedData;
      const storedChanged: string[] = (proposal.changed_fields as string[]) ?? [];

      // Re-run no extraction. All written values come from the stored
      // proposal — the client is trusted only for which fields to apply.
      const selected = requested.filter((f) => storedChanged.includes(f));
      if (selected.length === 0) {
        return json({ error: 'No applicable fields selected' }, 400);
      }

      const update: Record<string, unknown> = {};
      const nextMetadata = { ...(item.metadata ?? {}) };
      let metadataTouched = false;
      // Built from what actually landed, not from `selected`, so a failed
      // image download can never be reported as an applied change.
      const appliedFields: string[] = [];

      for (const field of selected) {
        if (field === 'name') {
          update.name = proposed.name;
          update.slug = generateSlug(proposed.name);
          appliedFields.push('name');
        } else if (field === 'description') {
          update.description = proposed.description;
          appliedFields.push('description');
        } else if (field === 'image_url') {
          const fallbackSlug = proposed.name ? generateSlug(proposed.name) : item.slug;
          const stored = await downloadAndStoreImage(
            proposed.image_url!, topicSlug ?? item.topic_id, fallbackSlug
          );
          if (stored) {
            update.image_url = stored;
            appliedFields.push('image_url');
          }
        } else if (field.startsWith('metadata.')) {
          const key = field.slice('metadata.'.length);
          nextMetadata[key] = proposed.metadata[key];
          metadataTouched = true;
          appliedFields.push(field);
        }
      }

      if (appliedFields.length === 0) {
        return json({ error: 'No applicable fields selected' }, 400);
      }

      if (metadataTouched) update.metadata = nextMetadata;
      update.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await serviceClient
        .from('items')
        .update(update)
        .eq('id', itemId)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to apply rescan:', updateError);
        if ((updateError as { code?: string }).code === '23505') {
          return json({ error: 'That name collides with an existing item in this topic' }, 409);
        }
        return json({ error: 'Failed to update item' }, 500);
      }

      const { error: auditError } = await serviceClient.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'apply_rescan',
        item_id: itemId,
        payload: {
          before: item,
          applied_fields: appliedFields,
          after: updated,
          confidence: proposal.confidence,
          sources: proposal.sources
        }
      });

      let auditFailed = false;
      if (auditError) {
        console.error('Failed to write admin_audit_log row for apply_rescan:', auditError);
        auditFailed = true;
      }

      // Delete the proposal so it cannot be replayed.
      const { error: deleteProposalError } = await serviceClient
        .from('admin_rescan_proposals')
        .delete()
        .eq('id', proposalId);
      if (deleteProposalError) {
        console.error('Failed to delete consumed rescan proposal:', deleteProposalError);
      }

      // Flag status is deliberately untouched — the admin resolves explicitly.
      return json({ item: updated, applied_fields: appliedFields, ...(auditFailed ? { audit_failed: true } : {}) });
    }

    // --- preview ---
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

    const proposed = await extractItemData(item.name, topicSlug);

    if (!proposed.found || proposed.confidence_score < 0.6) {
      return json({
        error: "Couldn't find reliable information on this one. Nothing to propose."
      }, 404);
    }

    const changed = diffFields(item as unknown as ItemRow, proposed);

    const proposedForClient: ProposedData = {
      name: proposed.title,
      description: proposed.description,
      metadata: proposed.metadata,
      image_url: proposed.image_url
    };

    // Self-maintaining table: sweep this item's stale proposals before
    // adding a new one.
    await serviceClient
      .from('admin_rescan_proposals')
      .delete()
      .eq('item_id', itemId)
      .lt('expires_at', new Date().toISOString());

    // Nothing changed: there is nothing an admin could apply, so don't
    // store a proposal row for it.
    if (changed.length === 0) {
      return json({
        proposal_id: null,
        current: item,
        proposed: proposedForClient,
        changed_fields: changed,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      });
    }

    const { data: savedProposal, error: saveError } = await serviceClient
      .from('admin_rescan_proposals')
      .insert({
        item_id: itemId,
        actor_id: user.id,
        proposed: proposedForClient,
        changed_fields: changed,
        confidence: proposed.confidence_score,
        sources: proposed.sources
      })
      .select('id')
      .single();

    if (saveError || !savedProposal) {
      console.error('Failed to store rescan proposal:', saveError);
      return json({ error: 'Failed to save proposal' }, 500);
    }

    return json({
      proposal_id: savedProposal.id,
      current: item,
      proposed: proposedForClient,
      changed_fields: changed,
      confidence: proposed.confidence_score,
      sources: proposed.sources
    });
  } catch (error) {
    console.error('Rescan failed:', error);
    return json({ error: 'Something broke. Honestly, surprised it worked this long.' }, 500);
  }
});
