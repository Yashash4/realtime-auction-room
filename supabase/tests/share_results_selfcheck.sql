-- share_results_selfcheck.sql — access-boundary checks for public results sharing.
--
-- SAFE TO RUN on the real Supabase project: everything is inside a transaction
-- that ROLLS BACK, so no rows persist. Depends on 0011. Proves get_room_results:
--   * returns a completed room's results for its token (players, squads, totals,
--     budget_remaining) with NO user_id / email / PII in the payload;
--   * returns NULL for a wrong token;
--   * returns NULL for a room that is NOT completed (the status gate).

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'share-admin@test'),
  ('00000000-0000-0000-0000-0000000000f1', 'share-team1@test'),
  ('00000000-0000-0000-0000-0000000000f2', 'share-team2@test');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into rooms (code, name, admin_id, team_budget, timer_seconds, increment_tiers)
values ('ZZSHARE', 'Share selfcheck', auth.uid(), 1000000, 30,
        '[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb);
-- A second, still-in-lobby room to prove the completed-only gate.
insert into rooms (code, name, admin_id) values ('ZZLOBBY', 'Not done', auth.uid());

insert into items (room_id, name, role, base_price, order_index)
select id, 'Player A', 'Batter', 100000, 1 from rooms where code = 'ZZSHARE';
insert into items (room_id, name, role, base_price, order_index)
select id, 'Player B', 'Bowler', 100000, 2 from rooms where code = 'ZZSHARE';

do $$
declare
  v_room    uuid;
  v_item_a  uuid;
  v_token   uuid;
  v_lobby   uuid;
  v_res     jsonb;
begin
  select id, share_token into v_room, v_token from rooms where code = 'ZZSHARE';
  select share_token into v_lobby from rooms where code = 'ZZLOBBY';
  select id into v_item_a from items where room_id = v_room and order_index = 1;

  -- Teams join.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
  perform join_room('ZZSHARE', 'Tigers');
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
  perform join_room('ZZSHARE', 'Lions');

  -- Run to completion: A sold to Tigers @ base; B unsold.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
  perform start_auction(v_room);
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
  perform place_bid(v_room, v_item_a, 100000, 's-a');
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);   -- A resolves -> B active
  update rooms set item_ends_at = now() - interval '1 second' where id = v_room;
  perform resolve_current_item(v_room);   -- B unsold -> room completes
  assert (select status from rooms where id = v_room) = 'completed', 'room should be completed';

  -- ---- Results for the valid token.
  v_res := get_room_results(v_token);
  assert v_res is not null, 'completed room must return results';
  assert v_res->'room'->>'name' = 'Share selfcheck', 'room name should match';
  assert v_res->'room'->>'currency' = '$', 'currency should match';
  assert (v_res->'room'->>'round')::int = 1, 'round should be 1';

  assert jsonb_array_length(v_res->'players') = 2, 'should list both players';
  assert exists (
    select 1 from jsonb_array_elements(v_res->'players') e
    where e->>'name' = 'Player A' and e->>'role' = 'Batter'
      and e->>'status' = 'sold' and e->>'won_by' = 'Tigers' and (e->>'price')::bigint = 100000
  ), 'A should be sold to Tigers @100k';
  assert exists (
    select 1 from jsonb_array_elements(v_res->'players') e
    where e->>'name' = 'Player B' and e->>'status' = 'unsold'
      and e->>'won_by' is null and e->>'price' is null
  ), 'B should be unsold with no buyer/price';

  assert jsonb_array_length(v_res->'teams') = 2, 'should list both teams';
  assert exists (
    select 1 from jsonb_array_elements(v_res->'teams') e
    where e->>'team_name' = 'Tigers' and (e->>'spent')::bigint = 100000
      and (e->>'budget_remaining')::bigint = 900000 and (e->>'player_count')::int = 1
  ), 'Tigers: spent 100k, 900k left, 1 player';
  assert exists (
    select 1 from jsonb_array_elements(v_res->'teams') e
    where e->>'team_name' = 'Lions' and (e->>'spent')::bigint = 0
      and (e->>'budget_remaining')::bigint = 1000000 and (e->>'player_count')::int = 0
  ), 'Lions: spent 0, full budget left, 0 players';

  -- ---- No PII leaks in the payload.
  assert v_res::text not like '%user_id%', 'payload must not contain user_id';
  assert v_res::text not like '%email%', 'payload must not contain email';
  assert v_res::text not like '%admin_id%', 'payload must not contain admin_id';

  -- ---- Wrong token -> null. Non-completed room -> null.
  assert get_room_results('00000000-0000-0000-0000-0000000000ff') is null, 'wrong token must return null';
  assert get_room_results(v_lobby) is null, 'a non-completed room must return null';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
