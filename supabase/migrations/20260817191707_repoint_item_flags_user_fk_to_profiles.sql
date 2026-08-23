-- item_flags.user_id previously pointed at auth.users(id), which PostgREST
-- cannot use to resolve the `profiles!item_flags_user_id_fkey` embed the
-- admin flag queue relies on (PGRST200: no relationship found).
--
-- This is semantically equivalent: profiles.id itself references
-- auth.users(id) (profiles_id_fkey, ON DELETE CASCADE), and a profile row
-- is created for every user by the handle_new_user trigger on
-- auth.users (on_auth_user_created). Repointing to public.profiles(id)
-- lets PostgREST resolve the embed while preserving the same cascade
-- semantics, and keeping the constraint name unchanged means the existing
-- `!item_flags_user_id_fkey` embed hints in the app keep working.
alter table public.item_flags
  drop constraint item_flags_user_id_fkey,
  add constraint item_flags_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
