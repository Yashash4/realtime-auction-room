-- 0009_watch_active_rooms.sql
-- Let any authenticated user WATCH an in-progress auction (status active/paused),
-- even if they're not a member, for the dashboard "Live Now" section and the
-- shared watch view. Reads only — joining as a team still requires the lobby
-- (join_room checks status = 'lobby'), and once a room completes, non-members
-- lose read access again (so private results stay private).

-- can_view_room gates items / bids / participants / events reads. Add live rooms.
create or replace function public.can_view_room(p_room uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from rooms r
    where r.id = p_room
      and (
        r.is_demo
        or r.status in ('active', 'paused')
        or r.admin_id = auth.uid()
        or exists (select 1 from room_participants rp where rp.room_id = r.id and rp.user_id = auth.uid())
      )
  );
$$;

-- The rooms SELECT policy (row's own columns; no re-query, RETURNING-safe).
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    is_demo
    or status in ('active', 'paused')
    or admin_id = auth.uid()
    or is_room_participant(id)
  );
