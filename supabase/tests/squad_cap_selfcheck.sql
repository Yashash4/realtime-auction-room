-- squad_cap_selfcheck.sql — invariants for max_players_per_team enforcement.
--
-- SAFE TO RUN on the real Supabase project: everything is inside a transaction
-- that ROLLS BACK. Depends on 0012. cap = 1: a team one short can win the current
-- item, then is rejected; a full team is rejected (with the squad-full message,
-- not the rate limit); a different team that's still short can bid.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'cap-admin@test'),
  ('00000000-0000-0000-0000-000000000a02', 'cap-team1@test'),
  ('00000000-0000-0000-0000-000000000a03', 'cap-team2@test');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';
insert into rooms (code, name, admin_id, team_budget, timer_seconds, increment_tiers, max_players_per_team)
values ('ZZCAP', 'Cap selfcheck', auth.uid(), 1000000, 30,
        '[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb, 1);

insert into items (room_id, name, base_price, order_index)
select id, 'Player A', 100000, 1 from rooms where code = 'ZZCAP';
insert into items (room_id, name, base_price, order_index)
select id, 'Player B', 100000, 2 from rooms where code = 'ZZCAP';

do $$
declare
  v_room   uuid;
  v_a      uuid;
  v_b      uuid;
  v_t1     uuid;
  v_t2     uuid;
  v_failed boolean;
  v_msg    text;
begin
  select id into v_room from rooms where code = 'ZZCAP';
  select id into v_a from items where room_id = v_room and order_index = 1;
  select id into v_b from items where room_id = v_room and order_index = 2;

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
  perform join_room('ZZCAP', 'Tigers');
  select id into v_t1 from room_participants where room_id = v_room and user_id = auth.uid();
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';
  perform join_room('ZZCAP', 'Lions');
  select id into v_t2 from room_participants where room_id = v_room and user_id = auth.uid();

  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a01';
  perform start_auction(v_room);   -- Player A active

  -- Tigers own 0 of 1 (one short) -> CAN bid on the current item.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
  perform place_bid(v_room, v_a, 100000, 'cap-a');

  -- Resolve A -> Tigers win -> now 1 of 1 (squad full). B becomes active.
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);
  assert (select sold_to from items where id = v_a) = v_t1, 'Tigers should win Player A';
  assert (select current_item_id from rooms where id = v_room) = v_b, 'Player B should be active';

  -- A FULL Tigers (1/1) is now rejected on B — and specifically by the cap.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a02';
  v_failed := false;
  begin
    perform place_bid(v_room, v_b, 100000, 'cap-b1');
  exception when others then v_failed := true; v_msg := SQLERRM;
  end;
  assert v_failed, 'a full squad (1/1) must be rejected';
  assert v_msg like '%squad is full%', 'rejection must be the squad cap, got: ' || coalesce(v_msg, '');

  -- Lions own 0 of 1 (one short) -> CAN still bid on B.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000a03';
  perform place_bid(v_room, v_b, 100000, 'cap-b2');
  assert (select count(*) from bids where item_id = v_b and participant_id = v_t2) = 1,
         'a one-short team can still bid';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
