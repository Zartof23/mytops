create table if not exists public.admin_rescan_proposals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  proposed jsonb not null,
  changed_fields text[] not null,
  confidence numeric,
  sources jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);

create index if not exists admin_rescan_proposals_item on public.admin_rescan_proposals(item_id);
create index if not exists admin_rescan_proposals_expiry on public.admin_rescan_proposals(expires_at);

alter table public.admin_rescan_proposals enable row level security;

create policy "Admins can read rescan proposals"
on public.admin_rescan_proposals for select
to authenticated
using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: written only by the service-role Edge Function,
-- same posture as admin_audit_log.
