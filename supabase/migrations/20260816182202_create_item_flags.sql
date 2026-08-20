-- User-submitted reports of incorrect item information.
-- Migration created: 2026-08-16

create table if not exists public.item_flags (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One OPEN flag per user per item. A user may flag again once the previous
-- report has been resolved or rejected.
create unique index if not exists item_flags_one_open_per_user
  on public.item_flags(item_id, user_id) where status = 'open';

create index if not exists item_flags_queue
  on public.item_flags(status, created_at desc);

create index if not exists item_flags_item_id
  on public.item_flags(item_id);

alter table public.item_flags enable row level security;

create policy "Users can create their own flags"
on public.item_flags for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users read own flags, admins read all"
on public.item_flags for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Users cannot edit or self-resolve a flag.
create policy "Admins can update flags"
on public.item_flags for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No DELETE policy: rows disappear only via the items/users cascade.
