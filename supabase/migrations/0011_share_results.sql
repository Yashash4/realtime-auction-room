-- 0011_share_results.sql
-- Public, login-free, read-only results sharing. Each room gets an unguessable
-- share_token (uuid). get_room_results(token) is a SECURITY DEFINER reader that
-- returns ONLY a completed room's results for the matching token — players,
-- per-team squads and totals — and nothing else (no ids, no emails, no user_id,
-- no other rooms, no in-progress rooms). Granted to anon so the share page needs
-- no session. The token + status='completed' filter is the sole access path.

alter table public.rooms
  add column share_token uuid not null unique default gen_random_uuid();

create or replace function public.get_room_results(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'room', jsonb_build_object(
      'name',     r.name,
      'currency', r.currency,
      'round',    r.round
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',   i.name,
        'role',   i.role,
        'status', i.status,
        'won_by', wt.team_name,
        'price',  i.sold_price
      ) order by i.order_index, i.created_at)
      from items i
      left join room_participants wt on wt.id = i.sold_to
      where i.room_id = r.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(t order by t.spent desc, t.team_name)
      from (
        select
          p.team_name,
          p.budget_remaining,
          coalesce(sum(i.sold_price), 0) as spent,
          count(i.id)                    as player_count,
          coalesce(
            jsonb_agg(jsonb_build_object('name', i.name, 'price', i.sold_price)
                      order by i.sold_price desc) filter (where i.id is not null),
            '[]'::jsonb
          ) as players
        from room_participants p
        left join items i on i.sold_to = p.id and i.status = 'sold'
        where p.room_id = r.id
        group by p.id, p.team_name, p.budget_remaining
      ) t
    ), '[]'::jsonb)
  )
  from rooms r
  where r.share_token = p_token
    and r.status = 'completed';
$$;

grant execute on function public.get_room_results(uuid) to anon, authenticated;
