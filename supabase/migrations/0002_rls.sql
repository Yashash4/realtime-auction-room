-- 0002_rls.sql — Row Level Security.
--
-- Principle: reads are scoped to rooms the user can see; auction-state WRITES
-- go ONLY through the SECURITY DEFINER functions in 0003_functions.sql (which
-- bypass RLS). The few direct writes allowed here are room CONFIG during lobby:
--   - admin creates a room and edits its settings while status = 'lobby'
--   - admin adds/edits/removes players while status = 'lobby'
-- Joining a room is a function (join_room) because it must look up a private
-- room by code before the user is a member.

-- ---------------------------------------------------------------------------
-- Visibility helper. SECURITY DEFINER so its internal lookups bypass RLS,
-- which avoids the room_participants self-reference recursion trap.
-- ---------------------------------------------------------------------------
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
        or r.admin_id = auth.uid()
        or exists (
          select 1 from room_participants rp
          where rp.room_id = r.id and rp.user_id = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.rooms               enable row level security;
alter table public.room_participants   enable row level security;
alter table public.items               enable row level security;
alter table public.bids                enable row level security;

-- profiles: display names are not sensitive; any authed user may read; self update.
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- rooms
create policy rooms_select on public.rooms
  for select to authenticated using (can_view_room(id));
create policy rooms_insert_admin on public.rooms
  for insert to authenticated with check (admin_id = auth.uid());
create policy rooms_update_admin_lobby on public.rooms
  for update to authenticated
  using (admin_id = auth.uid() and status = 'lobby')
  with check (admin_id = auth.uid());
create policy rooms_delete_admin on public.rooms
  for delete to authenticated using (admin_id = auth.uid());

-- room_participants: read if room visible. Inserts/updates happen via functions.
create policy participants_select on public.room_participants
  for select to authenticated using (can_view_room(room_id));

-- items: read if room visible; admin may manage players only during lobby.
create policy items_select on public.items
  for select to authenticated using (can_view_room(room_id));
create policy items_admin_write on public.items
  for all to authenticated
  using (exists (
    select 1 from rooms r
    where r.id = items.room_id and r.admin_id = auth.uid() and r.status = 'lobby'
  ))
  with check (exists (
    select 1 from rooms r
    where r.id = items.room_id and r.admin_id = auth.uid() and r.status = 'lobby'
  ));

-- bids: read if room visible. Inserts happen via place_bid (function) only.
create policy bids_select on public.bids
  for select to authenticated using (can_view_room(room_id));
