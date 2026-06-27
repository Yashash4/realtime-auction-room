-- 0001_schema.sql — tables, enums, profile trigger, realtime publication.
-- Run in the Supabase SQL editor (or via the CLI) before 0002_rls.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type room_status as enum ('lobby', 'active', 'paused', 'completed');
create type item_status as enum ('pending', 'active', 'sold', 'unsold');

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, auto-created on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player',
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  admin_id            uuid not null references auth.users (id) on delete cascade,
  status              room_status not null default 'lobby',
  current_item_id     uuid,                     -- FK added after items exists
  item_ends_at        timestamptz,              -- the authoritative countdown deadline
  paused_remaining_ms integer,                  -- remaining ms captured on pause
  team_budget         bigint not null default 100000000,   -- starting budget per team
  currency            text   not null default '$',         -- display label only
  increment_tiers     jsonb  not null default
    '[{"min_price":0,"step":50000},{"min_price":1000000,"step":100000}]'::jsonb,
  timer_seconds       integer not null default 30,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- room_participants — bidder TEAMS only (the admin is never a participant)
-- ---------------------------------------------------------------------------
create table public.room_participants (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  team_name        text not null,
  budget_remaining bigint not null,
  joined_at        timestamptz not null default now(),
  unique (room_id, user_id)
);

-- ---------------------------------------------------------------------------
-- items — the players/lots being auctioned
-- ---------------------------------------------------------------------------
create table public.items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  name        text not null,
  role        text,
  country     text,
  base_price  bigint not null default 0,
  image_url   text,
  order_index integer not null default 0,
  status      item_status not null default 'pending',
  sold_to     uuid references public.room_participants (id) on delete set null,
  sold_price  bigint,
  created_at  timestamptz not null default now()
);

alter table public.rooms
  add constraint rooms_current_item_fk
  foreign key (current_item_id) references public.items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- bids
-- ---------------------------------------------------------------------------
create table public.bids (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  item_id        uuid not null references public.items (id) on delete cascade,
  participant_id uuid not null references public.room_participants (id) on delete cascade,
  amount         bigint not null,
  created_at     timestamptz not null default now()
);

create index bids_item_amount_idx     on public.bids (item_id, amount desc);
create index items_room_order_idx     on public.items (room_id, order_index);
create index participants_room_idx    on public.room_participants (room_id);
create index rooms_code_idx           on public.rooms (code);

-- ---------------------------------------------------------------------------
-- Realtime — publish change feeds; FULL replica identity so DELETE/UPDATE
-- payloads carry the full row (used by client filters).
-- ---------------------------------------------------------------------------
alter table public.rooms              replica identity full;
alter table public.items              replica identity full;
alter table public.bids               replica identity full;
alter table public.room_participants  replica identity full;

alter publication supabase_realtime
  add table public.rooms, public.items, public.bids, public.room_participants;
