-- 0005_fix_rooms_select_rls.sql
--
-- Bug: creating a room failed with "new row violates row-level security policy
-- for table rooms" (42501). Cause: the app inserts with .insert().select(), i.e.
-- INSERT ... RETURNING, which makes Postgres evaluate the SELECT policy on the
-- NEW row. The old policy was `using (can_view_room(id))`, and can_view_room is a
-- SECURITY DEFINER function that RE-QUERIES the rooms table for that id — but the
-- just-inserted row isn't visible to the function's snapshot during RETURNING, so
-- it returned false and the insert was rejected.
--
-- Fix: the SELECT policy now tests the row's OWN columns (is_demo, admin_id)
-- directly — no re-query, so it's correct during RETURNING — and only falls back
-- to a definer helper for the participant case, which queries room_participants
-- (a different table), avoiding both the self-visibility issue and RLS recursion.

create or replace function public.is_room_participant(p_room uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from room_participants rp
    where rp.room_id = p_room and rp.user_id = auth.uid()
  );
$$;

grant execute on function public.is_room_participant(uuid) to authenticated;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    is_demo
    or admin_id = auth.uid()
    or is_room_participant(id)
  );
