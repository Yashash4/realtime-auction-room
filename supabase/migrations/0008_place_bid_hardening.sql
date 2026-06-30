-- 0008_place_bid_hardening.sql
-- Harden place_bid against double-submits and bid spam, using only Postgres:
--   * idempotency_key: a retry / double-click with the same key returns the
--     original bid instead of inserting a second row (unique index is the backstop).
--   * rate limit: at most 1 bid/sec per participant, checked inside the room lock
--     (the FOR UPDATE on the room serializes a participant's bids, so the check is
--     race-free without any external store).

alter table public.bids add column idempotency_key text;
create unique index bids_idempotency_key_idx
  on public.bids (idempotency_key) where idempotency_key is not null;

-- New 4-arg signature (p_key optional). Drop the old one first so there's no overload.
drop function if exists public.place_bid(uuid, uuid, bigint);

create function public.place_bid(p_room uuid, p_item uuid, p_amount bigint, p_key text default null)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room         public.rooms;
  v_item         public.items;
  v_part         public.room_participants;
  v_existing     public.bids;
  v_last         timestamptz;
  v_high         bigint;
  v_high_part    uuid;
  v_step         bigint;
  v_min_required bigint;
  v_bid          public.bids;
  v_now          timestamptz := now();
begin
  select * into v_room from rooms where id = p_room for update;   -- serialize this room
  if v_room.id is null then raise exception 'Room not found'; end if;

  -- Caller must be a bidder team (also blocks the admin, who is never a participant).
  select * into v_part from room_participants where room_id = p_room and user_id = auth.uid();
  if v_part.id is null then raise exception 'Only joined teams can bid'; end if;

  -- Idempotency: a retry/double-click with the same key returns the original bid,
  -- even if the auction has since moved on. Checked before time validation.
  if p_key is not null then
    select * into v_existing from bids where idempotency_key = p_key and participant_id = v_part.id;
    if v_existing.id is not null then return v_existing; end if;
  end if;

  if v_room.status <> 'active' then raise exception 'Auction is not active'; end if;
  if v_room.current_item_id is distinct from p_item then raise exception 'That item is not active'; end if;
  if v_room.item_ends_at is null or v_room.item_ends_at <= v_now then
    raise exception 'Bidding has closed for this item';
  end if;

  -- Rate limit: at most 1 bid/sec per participant (safe inside the room lock).
  select max(created_at) into v_last from bids where participant_id = v_part.id;
  if v_last is not null and v_now - v_last < interval '1 second' then
    raise exception 'You are bidding too fast — wait a second';
  end if;

  select * into v_item from items where id = p_item;

  select amount, participant_id into v_high, v_high_part
  from bids where item_id = p_item order by amount desc, created_at asc limit 1;

  if v_high is null then
    v_min_required := v_item.base_price;
  else
    if v_high_part = v_part.id then raise exception 'You are already the highest bidder'; end if;
    v_step := tier_step(v_room.increment_tiers, v_high);
    v_min_required := v_high + v_step;
  end if;

  if p_amount < v_min_required then raise exception 'Bid must be at least %', v_min_required; end if;
  if p_amount > v_part.budget_remaining then
    raise exception 'Bid exceeds your remaining budget (%)', v_part.budget_remaining;
  end if;

  insert into bids (room_id, item_id, participant_id, amount, idempotency_key)
  values (p_room, p_item, v_part.id, p_amount, p_key)
  returning * into v_bid;

  insert into auction_events (room_id, item_id, participant_id, type, amount)
  values (p_room, p_item, v_part.id, 'bid_placed', p_amount);

  if v_room.item_ends_at - v_now < make_interval(secs => v_room.anti_snipe_seconds) then
    update rooms set item_ends_at = v_now + make_interval(secs => v_room.anti_snipe_seconds) where id = p_room;
    insert into auction_events (room_id, item_id, type, data)
    values (p_room, p_item, 'timer_extended', jsonb_build_object('seconds', v_room.anti_snipe_seconds));
  end if;

  return v_bid;
end;
$$;

grant execute on function public.place_bid(uuid, uuid, bigint, text) to authenticated;
