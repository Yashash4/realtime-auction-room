-- 0010_unsold_round.sql
-- Round 2+: an admin-driven re-auction of the unsold players at reduced base
-- prices. Purely ADDITIVE — place_bid / resolve_current_item / start_auction are
-- untouched. resolve_current_item already advances to the next pending item or
-- completes the room, which is exactly what a freshly reopened batch needs.
-- Sold players stay sold across rounds, so the results page accumulates.

alter table public.rooms add column round integer not null default 1;

-- ---------------------------------------------------------------------------
-- start_unsold_round(room) -> rooms   (admin only; the room must be completed)
-- Reopens every unsold player at 75% of its CURRENT base (compounding each
-- round, floored at 1), bumps rooms.round, and re-activates the auction with the
-- first reopened player on the block — the same shape start_auction leaves.
-- ---------------------------------------------------------------------------
create or replace function public.start_unsold_round(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room  public.rooms;
  v_first public.items;
  v_count integer;
begin
  select * into v_room from rooms where id = p_room for update;   -- serialize this room
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can start a new round'; end if;
  if v_room.status <> 'completed' then raise exception 'Finish the current round first'; end if;

  select count(*) into v_count from items where room_id = p_room and status = 'unsold';
  if v_count = 0 then raise exception 'No unsold players to re-auction'; end if;

  -- Reopen the unsold players at 75% of their current base, floored at 1.
  update items
  set base_price = greatest(1, floor(base_price * 0.75))::bigint,
      status     = 'pending',
      sold_to    = null,
      sold_price = null
  where room_id = p_room and status = 'unsold';

  select * into v_first from items
  where room_id = p_room and status = 'pending'
  order by order_index, created_at limit 1;

  update items set status = 'active' where id = v_first.id;
  update rooms
  set round = round + 1,
      status = 'active',
      current_item_id = v_first.id,
      item_ends_at = now() + make_interval(secs => v_room.timer_seconds)
  where id = p_room
  returning * into v_room;

  insert into auction_events (room_id, item_id, type, data)
  values (p_room, v_first.id, 'round_started', jsonb_build_object('round', v_room.round, 'count', v_count));

  return v_room;
end;
$$;

grant execute on function public.start_unsold_round(uuid) to authenticated;
