-- Lock the item row during admin_delete_item's existence check so two
-- overlapping forced deletes cannot both "succeed", and so a rating/todo
-- inserted between the count and the delete cannot slip past the unforced
-- guard.

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

  select to_jsonb(i) into v_item from public.items i where i.id = p_item_id for update;
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
