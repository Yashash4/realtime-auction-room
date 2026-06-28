-- 0004_server_now.sql — authoritative clock for client countdown sync.
-- Clients call this once on mount to compute (serverNow - clientNow) and render
-- the timer against DB time, so machines with skewed clocks still agree.

create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

grant execute on function public.server_now() to authenticated, anon;
