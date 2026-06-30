-- rate_limit_selfcheck.sql — the per-item rate limit (migration 0013).
--
-- SAFE TO RUN on the real Supabase project: everything is inside a transaction
-- that ROLLS BACK. A team bids on player A, A resolves, B becomes active, and the
-- team bids on B in the same instant. The 1 bid/sec limit is scoped to the item,
-- so the fresh bid on B must succeed — pre-0013 it raised "bidding too fast"
-- because the cooldown leaked across items (this whole check would then abort).

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'rl-admin@test'),
  ('00000000-0000-0000-0000-000000000c02', 'rl-team@test');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c01';
insert into rooms (code, name, admin_id, team_budget, timer_seconds, increment_tiers)
values ('ZZRATE', 'Rate-limit selfcheck', auth.uid(), 1000000, 30, '[{"min_price":0,"step":50000}]'::jsonb);

insert into items (room_id, name, base_price, order_index) select id, 'Player A', 100000, 1 from rooms where code = 'ZZRATE';
insert into items (room_id, name, base_price, order_index) select id, 'Player B', 100000, 2 from rooms where code = 'ZZRATE';

do $$
declare
  v_room uuid;
  v_a    uuid;
  v_b    uuid;
  v_t    uuid;
begin
  select id into v_room from rooms where code = 'ZZRATE';
  select id into v_a from items where room_id = v_room and order_index = 1;
  select id into v_b from items where room_id = v_room and order_index = 2;

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c02';
  perform join_room('ZZRATE', 'Solo');
  select id into v_t from room_participants where room_id = v_room and user_id = auth.uid();

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c01';
  perform start_auction(v_room);   -- Player A active

  -- Team bids on A, A resolves (sold to the only bidder), B becomes active.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000c02';
  perform place_bid(v_room, v_a, 100000, 'rl-a');
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select current_item_id from rooms where id = v_room) = v_b, 'Player B should be active';

  -- Same transaction => the A bid is "under a second ago". A first bid on B must
  -- NOT be blocked (per-item scope). Pre-fix this raised and aborted the check.
  perform place_bid(v_room, v_b, 100000, 'rl-b');
  assert (select count(*) from bids where item_id = v_b and participant_id = v_t) = 1,
         'a team can bid on the new player immediately after the previous one';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
