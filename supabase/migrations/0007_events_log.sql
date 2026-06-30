-- 0007_events_log.sql
-- Append-only event log for replay + analytics. Rows are written ONLY from
-- inside the SECURITY DEFINER auction functions, so each event is in the same
-- transaction as the state change it describes (a sale and its 'sold' event
-- commit together or not at all). Clients can read events for rooms they can
-- see; they can never insert/update/delete them.

create table public.auction_events (
  id             bigint generated always as identity primary key,
  room_id        uuid not null references public.rooms (id) on delete cascade,
  item_id        uuid references public.items (id) on delete set null,
  participant_id uuid references public.room_participants (id) on delete set null,
  type           text not null,   -- auction_started | bid_placed | timer_extended | sold | unsold
  amount         bigint,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index auction_events_room_idx on public.auction_events (room_id, id);

alter table public.auction_events enable row level security;
create policy events_select on public.auction_events
  for select to authenticated using (can_view_room(room_id));
-- no insert/update/delete policies: only the SECURITY DEFINER functions write here.

-- ---------------------------------------------------------------------------
-- Re-create the three functions that change auction state, adding event writes.
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
  select * into v_room from rooms where id = p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.status <> 'active' then raise exception 'Auction is not active'; end if;
  if v_room.current_item_id is distinct from p_item then raise exception 'That item is not active'; end if;
  if v_room.item_ends_at is null or v_room.item_ends_at <= v_now then
    raise exception 'Bidding has closed for this item';
  end if;

  select * into v_part from room_participants where room_id = p_room and user_id = auth.uid();
  if v_part.id is null then raise exception 'Only joined teams can bid'; end if;

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

  insert into bids (room_id, item_id, participant_id, amount)
  values (p_room, p_item, v_part.id, p_amount)
  returning * into v_bid;

  insert into auction_events (room_id, item_id, participant_id, type, amount)
  values (p_room, p_item, v_part.id, 'bid_placed', p_amount);

  -- Anti-snipe: a late bid keeps at least anti_snipe_seconds on the clock.
  if v_room.item_ends_at - v_now < make_interval(secs => v_room.anti_snipe_seconds) then
    update rooms set item_ends_at = v_now + make_interval(secs => v_room.anti_snipe_seconds) where id = p_room;
    insert into auction_events (room_id, item_id, type, data)
    values (p_room, p_item, 'timer_extended', jsonb_build_object('seconds', v_room.anti_snipe_seconds));
  end if;

  return v_bid;
end;
$$;

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
  set status = 'active', current_item_id = v_first.id,
      item_ends_at = now() + make_interval(secs => v_room.timer_seconds)
  where id = p_room
  returning * into v_room;

  insert into auction_events (room_id, item_id, type) values (p_room, v_first.id, 'auction_started');

  return v_room;
end;
$$;

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
  if v_room.status <> 'active' then return v_room; end if;
  if v_room.current_item_id is null then return v_room; end if;
  if v_room.item_ends_at is null or v_room.item_ends_at > now() then return v_room; end if;

  select * into v_item from items where id = v_room.current_item_id;
  if v_item.status <> 'active' then return v_room; end if;

  select amount, participant_id into v_high, v_high_part
  from bids where item_id = v_item.id order by amount desc, created_at asc limit 1;

  if v_high_part is null then
    update items set status = 'unsold' where id = v_item.id;
    insert into auction_events (room_id, item_id, type) values (p_room, v_item.id, 'unsold');
  else
    update items set status = 'sold', sold_to = v_high_part, sold_price = v_high where id = v_item.id;
    update room_participants set budget_remaining = budget_remaining - v_high where id = v_high_part;
    insert into auction_events (room_id, item_id, participant_id, type, amount)
    values (p_room, v_item.id, v_high_part, 'sold', v_high);
  end if;

  select * into v_next from items
  where room_id = p_room and status = 'pending'
  order by order_index, created_at limit 1;

  if v_next.id is null then
    update rooms set status = 'completed', current_item_id = null, item_ends_at = null
    where id = p_room returning * into v_room;
  else
    update items set status = 'active' where id = v_next.id;
    update rooms set current_item_id = v_next.id,
        item_ends_at = now() + make_interval(secs => v_room.timer_seconds)
    where id = p_room returning * into v_room;
  end if;

  return v_room;
end;
$$;
