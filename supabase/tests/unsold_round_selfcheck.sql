-- unsold_round_selfcheck.sql — invariants for the unsold -> Round 2+ re-auction.
--
-- SAFE TO RUN on the real Supabase project: everything is inside a transaction
-- that ROLLS BACK, so no rows persist. Run in the Supabase SQL editor after the
-- migrations (it depends on 0010). Reaching the "ALL CHECKS PASSED" notice means
-- start_unsold_round behaves; any failed ASSERT aborts with its message.
--
-- Scenario: 2 players. Round 1 -> A sold, B unsold. Re-auction reopens B at a
-- compounding 75% base across rounds; A stays sold throughout. Round 3 B finally
-- sells, leaving zero unsold. Also asserts non-admin and zero-unsold are rejected.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'round-admin@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'round-team1@test'),
  ('00000000-0000-0000-0000-0000000000d2', 'round-team2@test');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into rooms (code, name, admin_id, team_budget, timer_seconds, increment_tiers)
values ('ZZROUND', 'Round selfcheck', auth.uid(), 1000000, 30,
        '[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb);

insert into items (room_id, name, base_price, order_index)
select id, 'Player A', 100000, 1 from rooms where code = 'ZZROUND';
insert into items (room_id, name, base_price, order_index)
select id, 'Player B', 100000, 2 from rooms where code = 'ZZROUND';

do $$
declare
  v_room   uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_t1     uuid;
  v_t2     uuid;
  v_failed boolean;
begin
  select id into v_room from rooms where code = 'ZZROUND';
  select id into v_item_a from items where room_id = v_room and order_index = 1;
  select id into v_item_b from items where room_id = v_room and order_index = 2;

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
  perform join_room('ZZROUND', 'Tigers');
  select id into v_t1 from room_participants where room_id = v_room and user_id = auth.uid();
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
  perform join_room('ZZROUND', 'Lions');
  select id into v_t2 from room_participants where room_id = v_room and user_id = auth.uid();

  -- ---- Round 1: A sold to Tigers @ base; B gets no bid -> unsold; room completes.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
  perform start_auction(v_room);
  assert (select round from rooms where id = v_room) = 1, 'room should start at round 1';

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
  perform place_bid(v_room, v_item_a, 100000, 'r1-a');

  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);   -- A resolves, B becomes active
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);   -- B unsold, room completes

  assert (select status from rooms where id = v_room) = 'completed', 'room should be completed after round 1';
  assert (select status from items where id = v_item_a) = 'sold', 'A should be sold';
  assert (select status from items where id = v_item_b) = 'unsold', 'B should be unsold';

  -- ---- Rejections: non-admin cannot start a round.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
  v_failed := false;
  begin perform start_unsold_round(v_room); exception when others then v_failed := true; end;
  assert v_failed, 'non-admin must not be able to start a new round';

  -- ---- Round 2: reopen B at floor(0.75 * 100000) = 75000.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
  perform start_unsold_round(v_room);
  assert (select round from rooms where id = v_room) = 2, 'round should be 2';
  assert (select status from rooms where id = v_room) = 'active', 'room should be active in round 2';
  assert (select current_item_id from rooms where id = v_room) = v_item_b, 'B should be the active player';
  assert (select status from items where id = v_item_b) = 'active', 'B should be active (first reopened)';
  assert (select base_price from items where id = v_item_b) = 75000, 'B base should be floor(0.75*100000)=75000';
  -- A stays sold across rounds.
  assert (select status from items where id = v_item_a) = 'sold', 'A must stay sold across rounds';
  assert (select sold_price from items where id = v_item_a) = 100000, 'A sold_price must not change';

  -- B again gets no bid -> unsold; room completes (round stays 2).
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select status from rooms where id = v_room) = 'completed', 'room should complete after round 2';
  assert (select round from rooms where id = v_room) = 2, 'round should still be 2 after completing';

  -- ---- Round 3: reopen B at floor(0.75 * 75000) = 56250 (compounding).
  perform start_unsold_round(v_room);
  assert (select round from rooms where id = v_room) = 3, 'round should be 3';
  assert (select status from rooms where id = v_room) = 'active', 'room should be active in round 3';
  assert (select base_price from items where id = v_item_b) = 56250, 'B base should compound to floor(0.75*75000)=56250';

  -- This time Lions buy B at its reduced base.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
  perform place_bid(v_room, v_item_b, 56250, 'r3-b');
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select status from items where id = v_item_b) = 'sold', 'B should be sold in round 3';
  assert (select sold_to from items where id = v_item_b) = v_t2, 'B should be sold to Lions';
  assert (select status from rooms where id = v_room) = 'completed', 'room should complete after round 3';

  -- ---- Rejection: zero unsold left -> cannot start another round.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
  v_failed := false;
  begin perform start_unsold_round(v_room); exception when others then v_failed := true; end;
  assert v_failed, 'starting a round with zero unsold players must be rejected';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
