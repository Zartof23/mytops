# Admin SQL verification

Manual checks for the SQL in `20260816181100`–`20260816190737`. No pgTAP
setup exists in this repo; these are written so they can be lifted into
pgTAP later without rework.

Run each check and confirm the expected result before considering the
admin feature done.

## 1. Non-admins cannot delete

As a signed-in non-admin:

    select public.admin_delete_item('<any-item-uuid>', false);

Expected: ERROR `Admin privileges required` (SQLSTATE 42501).

## 2. Non-admins cannot read links

As a signed-in non-admin:

    select public.admin_item_links('<any-item-uuid>');

Expected: ERROR `Admin privileges required`.

## 3. Unforced delete refuses when links exist

As an admin, against an item that has at least one rating:

    select public.admin_delete_item('<linked-item-uuid>', false);

Expected: ERROR naming the counts, e.g.
`Item is linked to 3 rating(s) and 1 todo entries. Re-run with force to delete anyway.`
The item must still exist afterwards.

## 4. Forced delete cascades

As an admin, against that same item:

    select public.admin_delete_item('<linked-item-uuid>', true);

Expected: returns `{"deleted": true, "links": {...}}`. Then confirm:

    select count(*) from items where id = '<linked-item-uuid>';        -- 0
    select count(*) from user_ratings where item_id = '<uuid>';        -- 0
    select count(*) from user_todo_lists where item_id = '<uuid>';     -- 0
    select count(*) from item_flags where item_id = '<uuid>';          -- 0
    select payload->'item'->>'name' from admin_audit_log
      where item_id = '<uuid>';                                        -- the item name

## 5. Clean delete needs no force

As an admin, against an item with no ratings and no todos:

    select public.admin_delete_item('<orphan-item-uuid>', false);

Expected: succeeds.

## 6. Self-promotion is blocked

As a signed-in non-admin:

    update public.profiles set is_admin = true where id = auth.uid();

Expected: `new row violates row-level security policy`.

## 7. Flag isolation

As user A, after user B has flagged an item:

    select count(*) from item_flags where user_id != auth.uid();

Expected: 0.

## 8. One open flag per user per item

As a signed-in user, insert two flags for the same item:

    insert into item_flags (item_id, user_id, reason)
      values ('<item>', auth.uid(), 'The year is wrong here');
    insert into item_flags (item_id, user_id, reason)
      values ('<item>', auth.uid(), 'The year is still wrong');

Expected: the second raises unique violation 23505. Then, as an admin,
resolve the first and retry the insert as the user — it must now succeed.

## Verification run log (2026-08-16)

All 8 checks were run against the live database inside `begin; ... rollback;`
blocks, using throwaway items/ratings/todos/flags created inside the same
transaction (never against pre-existing real rows). Non-admin impersonation
used `select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true); set local role authenticated;`.

| Check | Result |
|---|---|
| 1. Non-admin delete | ERROR `42501: Admin privileges required` |
| 2. Non-admin links read | ERROR `42501: Admin privileges required` |
| 3. Unforced delete with links | ERROR `P0001: Item is linked to 1 rating(s) and 1 todo entries. Re-run with force to delete anyway.` |
| 4. Forced delete cascades | `{"deleted": true, "links": {"raters": [...], "flag_count": 1, "todo_count": 1, "rating_count": 1}}`; row counts for the throwaway item's ratings/todos/flags were 0 immediately after, within the same transaction |
| 5. Clean delete, no force | Succeeded; item count 0 immediately after, within the same transaction |
| 6. Self-promotion blocked | ERROR `42501: new row violates row-level security policy for table "profiles"` |
| 7. Flag isolation | `count = 0` for user A querying flags where `user_id != auth.uid()` |
| 8. One open flag per user/item | Second insert raised `23505: duplicate key value violates unique constraint "item_flags_one_open_per_user"`; after resolving the first flag, retry insert succeeded |

Every transaction above ended in `rollback` (or aborted automatically on
error, which Postgres also rolls back). Final row counts after all testing
matched the pre-test baseline exactly: `items = 13`, `user_ratings = 5`,
`user_todo_lists = 8`, `item_flags = 0`, `admin_audit_log = 0`,
`profiles = 4` — no data was lost or added.
