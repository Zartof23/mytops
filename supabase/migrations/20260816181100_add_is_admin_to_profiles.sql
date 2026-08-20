-- Add admin flag to profiles and a helper for RLS policies.
-- Migration created: 2026-08-16
-- There is no UI to grant admin. Promote by SQL:
--   update public.profiles set is_admin = true where id = '<user-uuid>';

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- security definer is required: the profiles RLS policies would otherwise
-- block a user from reading the row this function needs.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Prevent self-promotion. WITH CHECK cannot be added to an existing policy,
-- so the policy is dropped and recreated. This policy already exists in
-- production; the drop is intentional.
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
);
