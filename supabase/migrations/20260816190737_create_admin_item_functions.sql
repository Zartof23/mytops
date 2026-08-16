-- Admin item management: audit log, link pre-check, hard delete.
-- Migration created: 2026-08-16

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('delete_item','apply_rescan')),
  -- Deliberately NOT a foreign key: for deletes the item is already gone.
  item_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at
  on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "Admins can read the audit log"
on public.admin_audit_log for select
to authenticated
using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies. Rows are written only by the
-- security-definer functions below and by the service-role Edge Function.

-- ---------------------------------------------------------------------------
-- What would break if this item were deleted?
-- ---------------------------------------------------------------------------
create or replace function public.admin_item_links(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ratings int;
  v_todos int;
  v_flags int;
  v_raters jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select count(*) into v_ratings from public.user_ratings where item_id = p_item_id;
  select count(*) into v_todos from public.user_todo_lists where item_id = p_item_id;
  select count(*) into v_flags from public.item_flags where item_id = p_item_id;

  -- Capped so the warning stays readable.
  select coalesce(jsonb_agg(s.name), '[]'::jsonb) into v_raters
  from (
    select coalesce(p.display_name, p.username, 'someone') as name
    from public.user_ratings r
    left join public.profiles p on p.id = r.user_id
    where r.item_id = p_item_id
    order by r.created_at
    limit 10
  ) s;

  return jsonb_build_object(
    'rating_count', v_ratings,
    'todo_count', v_todos,
    'flag_count', v_flags,
    'raters', v_raters
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hard delete. The link count is recomputed here so a stale UI, a race, or a
-- direct API call cannot bypass the warning.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_item(
  p_item_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links jsonb;
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select to_jsonb(i) into v_item from public.items i where i.id = p_item_id;
  if v_item is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  v_links := public.admin_item_links(p_item_id);

  -- Flags are not blocking: they cascade away with the item by design.
  if not p_force and (
       (v_links->>'rating_count')::int > 0
    or (v_links->>'todo_count')::int > 0
  ) then
    raise exception
      'Item is linked to % rating(s) and % todo entries. Re-run with force to delete anyway.',
      v_links->>'rating_count', v_links->>'todo_count'
      using errcode = 'P0001';
  end if;

  -- The full row is the only recovery path after this point.
  insert into public.admin_audit_log (actor_id, action, item_id, payload)
  values (
    auth.uid(), 'delete_item', p_item_id,
    jsonb_build_object('item', v_item, 'links', v_links, 'forced', p_force)
  );

  delete from public.items where id = p_item_id;

  return jsonb_build_object('deleted', true, 'links', v_links);
end;
$$;

revoke all on function public.admin_item_links(uuid) from public;
revoke all on function public.admin_delete_item(uuid, boolean) from public;
grant execute on function public.admin_item_links(uuid) to authenticated;
grant execute on function public.admin_delete_item(uuid, boolean) to authenticated;
