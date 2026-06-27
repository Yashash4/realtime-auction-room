-- 0003_functions.sql — the auction engine.
--
-- Every write to auction state goes through one of these SECURITY DEFINER
-- functions. Each locks the room row (SELECT ... FOR UPDATE) so concurrent
-- callers are serialized by Postgres: simultaneous bids/resolutions can never
-- corrupt state. auth.uid() inside a definer function still resolves to the
-- CALLING user (PostgREST sets the JWT GUC), so authorization is enforced here.

-- ---------------------------------------------------------------------------
-- tier_step(tiers, price) -> the bid increment for a given current price.
-- Picks the highest tier whose min_price <= price.
-- ---------------------------------------------------------------------------
create or replace function public.tier_step(p_tiers jsonb, p_price bigint)
returns bigint
language sql
immutable
as $$
  select coalesce(
    (
      select (t ->> 'step')::bigint
      from jsonb_array_elements(p_tiers) t
      where (t ->> 'min_price')::bigint <= p_price
      order by (t ->> 'min_price')::bigint desc
      limit 1
    ),
    (p_tiers -> 0 ->> 'step')::bigint
  );
$$;

-- ---------------------------------------------------------------------------
-- join_room(code, team_name) -> rooms
-- Looks the room up by code (definer bypasses RLS, so private rooms are
-- reachable before membership), then validates and inserts a participant.
-- The admin can never join their own room as a team.
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_code text, p_team_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_room from rooms where code = upper(p_code) for update;
  if v_room.id is null then raise exception 'No room with that code'; end if;
  if v_room.admin_id = v_uid then raise exception 'You are the admin of this room, not a team'; end if;
  if v_room.status <> 'lobby' then raise exception 'This auction has already started'; end if;

  if exists (select 1 from room_participants where room_id = v_room.id and user_id = v_uid) then
    return v_room; -- already joined; idempotent
  end if;

  insert into room_participants (room_id, user_id, team_name, budget_remaining)
  values (v_room.id, v_uid, coalesce(nullif(trim(p_team_name), ''), 'Team'), v_room.team_budget);

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_bid(room, item, amount) -> bids
-- ---------------------------------------------------------------------------
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

  -- Anti-snipe: a late bid keeps at least 10s on the clock.
  if v_room.item_ends_at - v_now < interval '10 seconds' then
    update rooms set item_ends_at = v_now + interval '10 seconds' where id = p_room;
  end if;

  return v_bid;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_auction(room) -> rooms  (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.start_auction(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room  public.rooms;
  v_first public.items;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can start the auction'; end if;
  if v_room.status <> 'lobby' then raise exception 'Auction already started'; end if;

  select * into v_first from items
  where room_id = p_room and status = 'pending'
  order by order_index, created_at limit 1;
  if v_first.id is null then raise exception 'Add at least one player before starting'; end if;

  update items set status = 'active' where id = v_first.id;
  update rooms
  set status = 'active',
      current_item_id = v_first.id,
      item_ends_at = now() + make_interval(secs => v_room.timer_seconds)
  where id = p_room
  returning * into v_room;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_current_item(room) -> rooms   (idempotent; the PRIMARY resolver)
-- Finalizes the active item once its deadline passes, then advances to the
-- next pending item or completes the room. Safe to call many times / racing:
-- the room lock + item-status guard guarantee each item is sold at most once.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_current_item(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room      public.rooms;
  v_item      public.items;
  v_high      bigint;
  v_high_part uuid;
  v_next      public.items;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.status <> 'active' then return v_room; end if;          -- paused/completed/lobby
  if v_room.current_item_id is null then return v_room; end if;
  if v_room.item_ends_at is null or v_room.item_ends_at > now() then
    return v_room;                                                  -- not expired -> no-op
  end if;

  select * into v_item from items where id = v_room.current_item_id;
  if v_item.status <> 'active' then return v_room; end if;          -- already resolved by a racer

  select amount, participant_id into v_high, v_high_part
  from bids where item_id = v_item.id order by amount desc, created_at asc limit 1;

  if v_high_part is null then
    update items set status = 'unsold' where id = v_item.id;
  else
    update items set status = 'sold', sold_to = v_high_part, sold_price = v_high where id = v_item.id;
    update room_participants set budget_remaining = budget_remaining - v_high where id = v_high_part;
  end if;

  select * into v_next from items
  where room_id = p_room and status = 'pending'
  order by order_index, created_at limit 1;

  if v_next.id is null then
    update rooms set status = 'completed', current_item_id = null, item_ends_at = null
    where id = p_room returning * into v_room;
  else
    update items set status = 'active' where id = v_next.id;
    update rooms
    set current_item_id = v_next.id,
        item_ends_at = now() + make_interval(secs => v_room.timer_seconds)
    where id = p_room returning * into v_room;
  end if;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin controls
-- ---------------------------------------------------------------------------
create or replace function public.admin_next_item(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can advance'; end if;
  if v_room.status <> 'active' then raise exception 'Auction is not active'; end if;

  update rooms set item_ends_at = now() where id = p_room;          -- force deadline, then resolve
  return resolve_current_item(p_room);
end;
$$;

create or replace function public.pause_auction(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can pause'; end if;
  if v_room.status <> 'active' then raise exception 'Auction is not active'; end if;

  update rooms
  set status = 'paused',
      paused_remaining_ms = greatest(0, (extract(epoch from (item_ends_at - now())) * 1000))::int
  where id = p_room returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.resume_auction(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can resume'; end if;
  if v_room.status <> 'paused' then raise exception 'Auction is not paused'; end if;

  update rooms
  set status = 'active',
      item_ends_at = now() + make_interval(secs => coalesce(paused_remaining_ms, 0) / 1000.0),
      paused_remaining_ms = null
  where id = p_room returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.end_auction(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'Only the admin can end the auction'; end if;
  if v_room.status = 'completed' then return v_room; end if;

  -- Finalize the current item fairly if one is live, then drop the rest.
  if v_room.status = 'active' then
    update rooms set item_ends_at = now() where id = p_room;
    perform resolve_current_item(p_room);
  end if;
  update items set status = 'unsold' where room_id = p_room and status in ('pending', 'active');
  update rooms set status = 'completed', current_item_id = null, item_ends_at = null
  where id = p_room returning * into v_room;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expose to authenticated users (called via supabase.rpc from the client).
-- ---------------------------------------------------------------------------
grant execute on function
  public.join_room(text, text),
  public.place_bid(uuid, uuid, bigint),
  public.start_auction(uuid),
  public.resolve_current_item(uuid),
  public.admin_next_item(uuid),
  public.pause_auction(uuid),
  public.resume_auction(uuid),
  public.end_auction(uuid)
to authenticated;
