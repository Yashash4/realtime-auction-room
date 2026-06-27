-- auction_selfcheck.sql — invariant checks for the auction engine.
--
-- SAFE TO RUN on the real Supabase project: everything happens inside a
-- transaction that ROLLS BACK at the end, so no rows persist. Run it in the
-- Supabase SQL editor after the migrations. If any ASSERT fails the whole
-- thing aborts with the failing message; if you reach "ALL CHECKS PASSED"
-- (raised as a NOTICE) the engine is behaving.
--
-- auth.uid() is mocked per-step via the request.jwt.claim.sub GUC, exactly the
-- value PostgREST sets from a real JWT.

begin;

-- Three users: an admin and two bidder teams.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'selfcheck-admin@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'selfcheck-team1@test'),
  ('00000000-0000-0000-0000-0000000000b2', 'selfcheck-team2@test');

-- Admin creates a room with two players. Budget 1,000,000; tiers 50k / 100k@1m.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into rooms (code, name, admin_id, team_budget, timer_seconds, increment_tiers)
values ('ZZTEST', 'Selfcheck', auth.uid(), 1000000, 30,
        '[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb);

insert into items (room_id, name, base_price, order_index)
select id, 'Player A', 100000, 1 from rooms where code = 'ZZTEST';
insert into items (room_id, name, base_price, order_index)
select id, 'Player B', 100000, 2 from rooms where code = 'ZZTEST';

do $$
declare
  v_room   uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_t1     uuid;
  v_t2     uuid;
  v_budget bigint;
  v_failed boolean;
begin
  select id into v_room from rooms where code = 'ZZTEST';
  select id into v_item_a from items where room_id = v_room and order_index = 1;
  select id into v_item_b from items where room_id = v_room and order_index = 2;

  -- tier_step boundaries
  assert tier_step('[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb, 500000)  = 50000,  'tier_step @500k should be 50k';
  assert tier_step('[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb, 1200000) = 100000, 'tier_step @1.2m should be 100k';

  -- Teams join (admin context first proves admin CANNOT join own room).
  v_failed := false;
  begin perform join_room('ZZTEST', 'AdminTeam'); exception when others then v_failed := true; end;
  assert v_failed, 'admin must not be able to join own room as a team';

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
  perform join_room('ZZTEST', 'Tigers');
  select id into v_t1 from room_participants where room_id = v_room and user_id = auth.uid();
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
  perform join_room('ZZTEST', 'Lions');
  select id into v_t2 from room_participants where room_id = v_room and user_id = auth.uid();

  -- Admin starts the auction.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
  perform start_auction(v_room);
  assert (select status from rooms where id = v_room) = 'active', 'room should be active';
  assert (select current_item_id from rooms where id = v_room) = v_item_a, 'Player A should be active first';

  -- Admin cannot bid (not a participant).
  v_failed := false;
  begin perform place_bid(v_room, v_item_a, 100000); exception when others then v_failed := true; end;
  assert v_failed, 'admin must not be able to bid';

  -- Tigers open at base 100k.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
  perform place_bid(v_room, v_item_a, 100000);

  -- Tigers cannot bid against themselves.
  v_failed := false;
  begin perform place_bid(v_room, v_item_a, 150000); exception when others then v_failed := true; end;
  assert v_failed, 'highest bidder must not raise their own bid';

  -- Lions must beat 100k + step(50k) = 150k. 120k is rejected, 150k accepted.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
  v_failed := false;
  begin perform place_bid(v_room, v_item_a, 120000); exception when others then v_failed := true; end;
  assert v_failed, 'bid below current + tier step must be rejected';
  perform place_bid(v_room, v_item_a, 150000);

  -- Expire the item and resolve. Player A -> sold to Lions @150k.
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select status from items where id = v_item_a) = 'sold', 'Player A should be sold';
  assert (select sold_to from items where id = v_item_a) = v_t2, 'Player A should be sold to Lions';
  assert (select sold_price from items where id = v_item_a) = 150000, 'Player A price should be 150k';
  select budget_remaining into v_budget from room_participants where id = v_t2;
  assert v_budget = 850000, 'Lions budget should be 1,000,000 - 150,000';
  assert (select current_item_id from rooms where id = v_room) = v_item_b, 'should advance to Player B';

  -- Idempotent resolve: calling again must NOT double-charge or re-sell.
  perform resolve_current_item(v_room);
  assert (select sold_price from items where id = v_item_a) = 150000, 'price must not change on re-resolve';
  select budget_remaining into v_budget from room_participants where id = v_t2;
  assert v_budget = 850000, 'budget must not change on re-resolve (idempotent)';

  -- Budget enforcement: Lions (850k left) cannot bid 900k on Player B.
  v_failed := false;
  begin perform place_bid(v_room, v_item_b, 900000); exception when others then v_failed := true; end;
  assert v_failed, 'bid over remaining budget must be rejected';

  -- Player B gets no bids, expires -> unsold, room completes.
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select status from items where id = v_item_b) = 'unsold', 'Player B should be unsold';
  assert (select status from rooms where id = v_room) = 'completed', 'room should be completed';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
