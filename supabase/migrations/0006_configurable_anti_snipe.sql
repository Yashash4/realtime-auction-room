-- 0006_configurable_anti_snipe.sql
-- Make the anti-snipe extension admin-configurable per room (default 20s) instead
-- of a hardcoded 10s, so late bidders get a real chance to respond.

alter table public.rooms
  add column anti_snipe_seconds integer not null default 20;

-- Replace place_bid to extend the clock to anti_snipe_seconds (was 10s).
create or replace function public.place_bid(p_room uuid, p_item uuid, p_amount bigint)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room         public.rooms;
  v_item         public.items;
  v_part         public.room_participants;
  v_high         bigint;
  v_high_part    uuid;
  v_step         bigint;
  v_min_required bigint;
  v_bid          public.bids;
  v_now          timestamptz := now();
begin
  select * into v_room from rooms where id = p_room for update;     -- serialize this room
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.status <> 'active' then raise exception 'Auction is not active'; end if;
  if v_room.current_item_id is distinct from p_item then raise exception 'That item is not active'; end if;
  if v_room.item_ends_at is null or v_room.item_ends_at <= v_now then
    raise exception 'Bidding has closed for this item';
  end if;

  -- Caller must be a bidder team. The admin is never a participant, so this
  -- single check also enforces "admin cannot bid".
  select * into v_part from room_participants where room_id = p_room and user_id = auth.uid();
  if v_part.id is null then raise exception 'Only joined teams can bid'; end if;

  select * into v_item from items where id = p_item;

  select amount, participant_id into v_high, v_high_part
  from bids where item_id = p_item order by amount desc, created_at asc limit 1;

  if v_high is null then
    v_min_required := v_item.base_price;            -- opening bid: at least base price
  else
    if v_high_part = v_part.id then raise exception 'You are already the highest bidder'; end if;
    v_step := tier_step(v_room.increment_tiers, v_high);
    v_min_required := v_high + v_step;
  end if;

  if p_amount < v_min_required then
    raise exception 'Bid must be at least %', v_min_required;
  end if;
  if p_amount > v_part.budget_remaining then
    raise exception 'Bid exceeds your remaining budget (%)', v_part.budget_remaining;
  end if;

  insert into bids (room_id, item_id, participant_id, amount)
  values (p_room, p_item, v_part.id, p_amount)
  returning * into v_bid;

  -- Anti-snipe: a late bid keeps at least anti_snipe_seconds on the clock.
  if v_room.item_ends_at - v_now < make_interval(secs => v_room.anti_snipe_seconds) then
    update rooms set item_ends_at = v_now + make_interval(secs => v_room.anti_snipe_seconds) where id = p_room;
  end if;

  return v_bid;
end;
$$;
