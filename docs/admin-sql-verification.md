# Admin SQL verification

Manual checks for the SQL in `20260816181100`–`20260816202107`. No pgTAP
setup exists in this repo; these are written so they can be lifted into
pgTAP later without rework.

**Note on `admin-rescan-item` preview:** a later migration
(`20260816205729_create_admin_rescan_proposals.sql`, outside the range
above) added `admin_rescan_proposals`. Preview is *not* a pure read: it
inserts a proposal row there so apply can later write from a value the
admin actually reviewed instead of re-extracting. The invariant that still
holds — and that matters for this document's checks — is that preview never
writes to `items`; `items.updated_at` is unchanged until an admin applies a
proposal. Do not describe preview as leaving the database untouched in
every sense; it is untouched only with respect to `items` and any table
other than `admin_rescan_proposals`.

**Every check below is safe to run verbatim, including against production.**
Checks that exercise `admin_delete_item` create their own throwaway item
(and throwaway rating/todo rows where needed) inside a `begin; ... rollback;`
block and operate only on those rows. None of them touch a real item. Do
not remove the `rollback;` from any block, and do not adapt these checks to
run against a real item id — that defeats the whole point.

## Impersonation technique

Run everything from the Supabase SQL editor, which connects as the
`postgres`/service role by default. To act as a specific user (admin or
non-admin), set the request JWT claim and drop to the `authenticated` role
for the rest of the transaction:

    select set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated"}', true);
    set local role authenticated;

Both settings are transaction-local (`set local`, and `set_config(..., true)`
for the third "is_local" argument), so they reset automatically at
`commit`/`rollback`. If you need to switch users mid-transaction, call
`reset role;` before setting the new role.

Use these two real ids for a two-party check (adjust for your project):

- admin: `84935058-ef56-41d0-9cef-9d414903bd60`
- non-admin: `140af90d-02a3-419e-8f1b-e35de41a1fe2`
- a topic id for throwaway items: `058745dd-56b4-48c7-92ce-79491351a16a` (series)

Run each check and confirm the expected result before considering the
admin feature done.

## 1. Non-admins cannot delete

    begin;
    select set_config('request.jwt.claims', '{"sub":"140af90d-02a3-419e-8f1b-e35de41a1fe2","role":"authenticated"}', true);
    set local role authenticated;
    select public.admin_delete_item('00000000-0000-0000-0000-000000000000', false);
    rollback;

Expected: ERROR `Admin privileges required` (SQLSTATE 42501). Any item id
works here — the admin check runs before the item is looked up — but the
zero UUID above avoids even touching a real row.

## 2. Non-admins cannot read links

    begin;
    select set_config('request.jwt.claims', '{"sub":"140af90d-02a3-419e-8f1b-e35de41a1fe2","role":"authenticated"}', true);
    set local role authenticated;
    select public.admin_item_links('00000000-0000-0000-0000-000000000000');
    rollback;

Expected: ERROR `Admin privileges required`.

## 3. Unforced delete refuses when links exist (ratings and todos block independently)

The force guard is an OR across two independent counts. Check each side on
its own item so a bug in one arm (e.g. only checking ratings) would be caught.

Ratings-only:

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Ratings Only', 'throwaway-ratings-only', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into public.user_ratings (user_id, item_id, rating)
    select '84935058-ef56-41d0-9cef-9d414903bd60', id, 3 from new_item;

    select public.admin_delete_item(id, false) from public.items where slug = 'throwaway-ratings-only';
    rollback;

Expected: ERROR naming the counts, e.g.
`Item is linked to 1 rating(s) and 0 todo entries. Re-run with force to delete anyway.`

Todos-only:

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Todos Only', 'throwaway-todos-only', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into public.user_todo_lists (user_id, item_id, topic_id)
    select '84935058-ef56-41d0-9cef-9d414903bd60', id, '058745dd-56b4-48c7-92ce-79491351a16a' from new_item;

    select public.admin_delete_item(id, false) from public.items where slug = 'throwaway-todos-only';
    rollback;

Expected: ERROR naming the counts, e.g.
`Item is linked to 0 rating(s) and 1 todo entries. Re-run with force to delete anyway.`

In both cases the item must still exist after `rollback` — which it
trivially does, since it never existed outside the rolled-back transaction.

## 4. Forced delete cascades

Capture the throwaway item's id into a temp table so it can still be
queried by `item_id` after the row is deleted:

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    create temporary table _t4_item (id uuid);

    with ins as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Forced Delete', 'throwaway-forced-delete', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into _t4_item select id from ins;

    insert into public.user_ratings (user_id, item_id, rating)
    select '84935058-ef56-41d0-9cef-9d414903bd60', id, 5 from _t4_item;

    insert into public.user_todo_lists (user_id, item_id, topic_id)
    select '84935058-ef56-41d0-9cef-9d414903bd60', id, '058745dd-56b4-48c7-92ce-79491351a16a' from _t4_item;

    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'test flag for cascade check' from _t4_item;

    select public.admin_delete_item(id, true) from _t4_item;                                    -- {"deleted": true, "links": {...}}
    select count(*) from public.items where id in (select id from _t4_item);                     -- 0
    select count(*) from public.user_ratings where item_id in (select id from _t4_item);          -- 0
    select count(*) from public.user_todo_lists where item_id in (select id from _t4_item);       -- 0
    select count(*) from public.item_flags where item_id in (select id from _t4_item);            -- 0
    select payload->'item'->>'name' from public.admin_audit_log
      where item_id in (select id from _t4_item);                                                 -- 'Throwaway Forced Delete'

    rollback;

## 5. Clean delete needs no force

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Clean Delete', 'throwaway-clean-delete', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    select public.admin_delete_item(id, false) from new_item;

    select count(*) from public.items where slug = 'throwaway-clean-delete';  -- 0
    rollback;

Expected: succeeds (no ratings/todos means no force needed).

## 6. Self-promotion is blocked

    begin;
    select set_config('request.jwt.claims', '{"sub":"140af90d-02a3-419e-8f1b-e35de41a1fe2","role":"authenticated"}', true);
    set local role authenticated;
    update public.profiles set is_admin = true where id = auth.uid();
    rollback;

Expected: `new row violates row-level security policy`.

## 7. Flag isolation

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Flag Isolation', 'throwaway-flag-isolation', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'flagged by "user B"' from new_item;

    reset role;
    select set_config('request.jwt.claims', '{"sub":"140af90d-02a3-419e-8f1b-e35de41a1fe2","role":"authenticated"}', true);
    set local role authenticated;

    select count(*) from public.item_flags
      where user_id != auth.uid()
      and item_id in (select id from public.items where slug = 'throwaway-flag-isolation');

    rollback;

Expected: `count = 0` — user A cannot see user B's flag.

## 8. One open flag per user per item

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Duplicate Flag', 'throwaway-duplicate-flag', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'The year is wrong here' from new_item;

    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'The year is still wrong'
    from public.items where slug = 'throwaway-duplicate-flag';

    rollback;

Expected: the second insert raises unique violation 23505
(`item_flags_one_open_per_user`).

Then, in a fresh transaction, confirm resolve-then-retry succeeds:

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;

    with new_item as (
      insert into public.items (topic_id, name, slug, source, created_by)
      values ('058745dd-56b4-48c7-92ce-79491351a16a', 'Throwaway Resolve Retry', 'throwaway-resolve-retry', 'user_submitted', '84935058-ef56-41d0-9cef-9d414903bd60')
      returning id
    )
    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'The year is wrong here' from new_item;

    update public.item_flags set status = 'resolved', resolved_by = '84935058-ef56-41d0-9cef-9d414903bd60', resolved_at = now()
    where item_id in (select id from public.items where slug = 'throwaway-resolve-retry') and status = 'open';

    insert into public.item_flags (item_id, user_id, reason)
    select id, '84935058-ef56-41d0-9cef-9d414903bd60', 'The year is still wrong retry'
    from public.items where slug = 'throwaway-resolve-retry'
    returning id;

    rollback;

Expected: the final insert succeeds (returns a new flag id).

## 9. Non-admins cannot read the audit log

    begin;
    select set_config('request.jwt.claims', '{"sub":"140af90d-02a3-419e-8f1b-e35de41a1fe2","role":"authenticated"}', true);
    set local role authenticated;
    select count(*) from public.admin_audit_log;
    rollback;

Expected: `count = 0` — RLS filters every row for a non-admin (no error,
because the policy is a `using` clause, not a blanket deny; a non-admin
simply sees nothing).

## 10. Nobody can write the audit log directly, not even an admin

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;
    insert into public.admin_audit_log (actor_id, action, item_id, payload)
    values ('84935058-ef56-41d0-9cef-9d414903bd60', 'delete_item', null, '{}'::jsonb);
    rollback;

Expected: ERROR `new row violates row-level security policy for table
"admin_audit_log"` — there are no INSERT/UPDATE/DELETE policies, so even an
admin cannot write directly. Only the `security definer` functions (running
as their owner, which bypasses RLS) can insert audit rows.

## 11. Missing item raises P0002

    begin;
    select set_config('request.jwt.claims', '{"sub":"84935058-ef56-41d0-9cef-9d414903bd60","role":"authenticated"}', true);
    set local role authenticated;
    select public.admin_delete_item('00000000-0000-0000-0000-000000000000', false);
    rollback;

Expected: ERROR `Item not found` (SQLSTATE P0002).

---

Checks 3 and 6 are the security boundary — if either fails, stop and fix
the SQL before shipping.

## Verification run log (2026-08-16)

All checks above were run against the live database inside `begin; ...
rollback;` blocks, using throwaway items/ratings/todos/flags created inside
the same transaction (never against pre-existing real rows).

| Check | Result |
|---|---|
| 1. Non-admin delete | `ERROR: 42501: Admin privileges required` |
| 2. Non-admin links read | `ERROR: 42501: Admin privileges required` |
| 3. Unforced delete, ratings-only | `ERROR: P0001: Item is linked to 1 rating(s) and 0 todo entries. Re-run with force to delete anyway.` |
| 3. Unforced delete, todos-only | `ERROR: P0001: Item is linked to 0 rating(s) and 1 todo entries. Re-run with force to delete anyway.` |
| 4. Forced delete cascades | `{"deleted": true, "links": {"raters": [...], "flag_count": 1, "todo_count": 1, "rating_count": 1}}`; ratings/todos/flags for the throwaway item all counted 0 immediately after, within the same transaction |
| 5. Clean delete, no force | Succeeded; item count 0 immediately after, within the same transaction |
| 6. Self-promotion blocked | `ERROR: 42501: new row violates row-level security policy for table "profiles"` |
| 7. Flag isolation | `count = 0` for user A querying flags where `user_id != auth.uid()` |
| 8. One open flag per user/item | Second insert raised `23505: duplicate key value violates unique constraint "item_flags_one_open_per_user"`; after resolving the first flag, retry insert succeeded (new row returned) |
| 9. Non-admin cannot read audit log | `count = 0` |
| 10. Nobody can insert audit log directly | `ERROR: 42501: new row violates row-level security policy for table "admin_audit_log"` |
| 11. Missing item raises P0002 | `ERROR: P0002: Item not found` |

Every transaction above ended in `rollback` (or aborted automatically on
error, which Postgres also rolls back). Final row counts after all testing
(both the original pass and this follow-up pass, which added the row-lock
migration `20260816202107` and checks 3/9/10/11) matched the baseline
exactly: `items = 13`, `user_ratings = 5`, `user_todo_lists = 8`,
`item_flags = 0`, `admin_audit_log = 0`, `profiles = 4` — no data was lost
or added.
