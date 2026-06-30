-- private_room_selfcheck.sql — visibility invariants for public vs private rooms.
--
-- SAFE TO RUN on the real Supabase project: everything is inside a transaction
-- that ROLLS BACK. Depends on 0012. Confirms a PRIVATE room is NOT readable by a
-- non-member (both the can_view_room gate and the rooms_select RLS policy, the
-- latter exercised as a real `authenticated` non-member), while a public active
-- room is, and members/admin always see their private room.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'rls-admin@test'),
  ('00000000-0000-0000-0000-000000000b02', 'rls-member@test'),
  ('00000000-0000-0000-0000-000000000b03', 'rls-outsider@test');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';
insert into rooms (code, name, admin_id, is_public) values ('ZZPRIV', 'Private room', auth.uid(), false);
insert into rooms (code, name, admin_id, is_public) values ('ZZPUB',  'Public room',  auth.uid(), true);
insert into items (room_id, name, base_price, order_index) select id, 'P', 100000, 1 from rooms where code = 'ZZPRIV';
insert into items (room_id, name, base_price, order_index) select id, 'P', 100000, 1 from rooms where code = 'ZZPUB';

do $$
declare
  v_priv uuid;
  v_pub  uuid;
  v_cnt  int;
begin
  select id into v_priv from rooms where code = 'ZZPRIV';
  select id into v_pub  from rooms where code = 'ZZPUB';

  -- A team joins the private room while it is in the lobby (join-by-code still works).
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b02';
  perform join_room('ZZPRIV', 'Members Only');

  -- Admin starts both auctions -> active/paused state, where watch access applies.
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';
  perform start_auction(v_priv);
  perform start_auction(v_pub);

  -- can_view_room gate (used for items/bids/participants/events reads).
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b03';  -- outsider
  assert not can_view_room(v_priv), 'an outsider must NOT view a private room';
  assert can_view_room(v_pub),      'anyone may view a public, active room';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b02';  -- member
  assert can_view_room(v_priv),     'a joined team must view its private room';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b01';  -- admin
  assert can_view_room(v_priv),     'the admin must view its private room';

  -- rooms_select RLS policy, exercised as a REAL authenticated non-member.
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b03';  -- outsider
  select count(*) into v_cnt from rooms where id = v_priv;
  assert v_cnt = 0, 'RLS: a non-member must not read a private room row';
  select count(*) into v_cnt from rooms where id = v_pub;
  assert v_cnt = 1, 'RLS: a non-member may read a public active room row';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000b02';  -- member
  select count(*) into v_cnt from rooms where id = v_priv;
  assert v_cnt = 1, 'RLS: a member may read its private room row';
  reset role;

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
