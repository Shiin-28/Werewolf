-- =====================================================================
-- Werewolf GM Companion — Milestone 1: schema, RLS, lobby & joining
-- Paste into Supabase → SQL Editor → Run. Run once.
--
-- Design:
--   * Clients can only SELECT, and RLS decides what each device sees.
--   * Every write goes through a SECURITY DEFINER function below, which
--     checks auth.uid() itself. There are no insert/update/delete policies.
--   * Public changes bump games.version so every client refetches.
--     Secret changes (roles, night actions, votes) are pushed only to the
--     devices that RLS lets see them.
-- =====================================================================

-- ---------- Types ----------------------------------------------------
create type public.game_phase as enum
  ('lobby', 'role_reveal', 'night', 'morning', 'day', 'voting', 'vote_result', 'game_over');
create type public.night_step as enum ('knight', 'shaman', 'wolves', 'done');
create type public.game_role  as enum ('villager', 'shaman', 'knight', 'werewolf', 'madman');

-- ---------- Tables: public within a game -----------------------------
create table public.games (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  gm_user_id      uuid not null references auth.users on delete cascade,
  phase           public.game_phase not null default 'lobby',
  night_step      public.night_step,
  round           int  not null default 0,          -- Night N / Day N
  paused          boolean not null default false,
  player_count    int  not null default 5 check (player_count between 3 and 20),
  role_counts     jsonb not null
                  default '{"villager":2,"shaman":1,"knight":1,"werewolf":1,"madman":0}',
  reveal_on_death boolean not null default false,
  timer_seconds   int check (timer_seconds is null or timer_seconds between 30 and 1800),
  timer_ends_at   timestamptz,
  votes_cast      int  not null default 0,          -- powers "5/8 voted"
  pending_winner  text check (pending_winner in ('village', 'werewolf')),
  winner          text check (winner in ('village', 'werewolf')),
  version         bigint not null default 0,        -- bumped on every public change
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games on delete cascade,
  user_id       uuid references auth.users on delete set null,  -- null for bots
  name          text not null check (char_length(name) between 1 and 20),
  seat          int  not null,
  is_bot        boolean not null default false,
  is_alive      boolean not null default true,
  seen_role     boolean not null default false,
  revealed_role public.game_role,   -- only set on death (if setting on) or at game over
  created_at    timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, seat)
);
create unique index players_name_unique on public.players (game_id, lower(name));
create index players_game_idx on public.players (game_id);

create table public.events (       -- public announcements ("Ana was killed")
  id               bigint generated always as identity primary key,
  game_id          uuid not null references public.games on delete cascade,
  kind             text not null check (kind in ('morning', 'vote', 'manual')),
  round            int  not null,
  victim_player_id uuid references public.players on delete set null,  -- null = no one died
  tally            jsonb,          -- vote counts per target, never who voted for whom
  created_at       timestamptz not null default now()
);
create index events_game_idx on public.events (game_id);

-- ---------- Tables: SECRET ---------------------------------------------
create table public.player_roles (
  player_id uuid primary key references public.players on delete cascade,
  game_id   uuid not null references public.games on delete cascade,
  role      public.game_role not null
);
create index player_roles_game_idx on public.player_roles (game_id);

create table public.night_actions (
  game_id          uuid not null references public.games on delete cascade,
  round            int  not null,
  kind             text not null check (kind in ('protect', 'inspect', 'kill')),
  actor_player_id  uuid references public.players on delete set null,
  target_player_id uuid references public.players on delete set null,  -- null = skipped
  result           text check (result in ('white', 'black')),          -- inspect only
  locked           boolean not null default false,  -- wolves: live proposal vs. locked in
  updated_at       timestamptz not null default now(),
  primary key (game_id, round, kind)
);

create table public.votes (
  game_id          uuid not null references public.games on delete cascade,
  round            int  not null,
  voter_player_id  uuid not null references public.players on delete cascade,
  target_player_id uuid references public.players on delete cascade,   -- null = Skip
  updated_at       timestamptz not null default now(),
  primary key (game_id, round, voter_player_id)
);

-- ---------- RLS helpers (SECURITY DEFINER = no policy recursion) ------
create or replace function public.is_gm(p_game uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from games where id = p_game and gm_user_id = auth.uid());
$$;

create or replace function public.my_player_id(p_game uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where game_id = p_game and user_id = auth.uid();
$$;

create or replace function public.my_role(p_game uuid) returns public.game_role
language sql stable security definer set search_path = public as $$
  select r.role from player_roles r
  join players p on p.id = r.player_id
  where p.game_id = p_game and p.user_id = auth.uid();
$$;

-- ---------- Row Level Security ----------------------------------------
alter table public.games         enable row level security;
alter table public.players       enable row level security;
alter table public.events        enable row level security;
alter table public.player_roles  enable row level security;
alter table public.night_actions enable row level security;
alter table public.votes         enable row level security;

-- Belt and braces: clients never write directly.
revoke insert, update, delete, truncate on
  public.games, public.players, public.events,
  public.player_roles, public.night_actions, public.votes
from anon, authenticated;

create policy games_select on public.games for select to authenticated
  using (gm_user_id = auth.uid() or public.my_player_id(id) is not null);

create policy players_select on public.players for select to authenticated
  using (public.is_gm(game_id) or public.my_player_id(game_id) is not null);

create policy events_select on public.events for select to authenticated
  using (public.is_gm(game_id) or public.my_player_id(game_id) is not null);

create policy player_roles_select on public.player_roles for select to authenticated
  using (
       public.is_gm(game_id)
    or player_id = public.my_player_id(game_id)                                   -- own role
    or (role = 'werewolf' and public.my_role(game_id) in ('werewolf', 'madman'))  -- wolves + madman see wolves
  );

create policy night_actions_select on public.night_actions for select to authenticated
  using (
       public.is_gm(game_id)
    or (kind in ('protect', 'inspect') and actor_player_id = public.my_player_id(game_id))
    or (kind = 'kill' and public.my_role(game_id) = 'werewolf')
  );

create policy votes_select on public.votes for select to authenticated
  using (public.is_gm(game_id) or voter_player_id = public.my_player_id(game_id));

-- ---------- Realtime ---------------------------------------------------
alter publication supabase_realtime add table
  public.games, public.players, public.events,
  public.player_roles, public.night_actions, public.votes;

-- ---------- Internal helpers -------------------------------------------
create or replace function public.touch_game(p_game uuid) returns void
language sql security definer set search_path = public as $$
  update games set version = version + 1, updated_at = now() where id = p_game;
$$;

create or replace function public.gen_game_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- no I / O
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from games where code = v_code);
  end loop;
  return v_code;
end $$;

-- Locks the game row and checks the caller is its GM.
create or replace function public.lock_game_as_gm(p_game uuid) returns public.games
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'Game not found'; end if;
  if g.gm_user_id is distinct from auth.uid() then
    raise exception 'Only the GM can do that';
  end if;
  return g;
end $$;

-- ---------- RPCs: lobby -------------------------------------------------
create or replace function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;

create or replace function public.create_game() returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  v_code := gen_game_code();
  insert into games (code, gm_user_id) values (v_code, auth.uid());
  return v_code;
end $$;

create or replace function public.update_settings(
  p_game            uuid,
  p_player_count    int,
  p_role_counts     jsonb,
  p_reveal_on_death boolean,
  p_timer_seconds   int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_counts jsonb;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'lobby' then raise exception 'Settings are locked once the game starts'; end if;
  if p_player_count not between 3 and 20 then raise exception 'Player count must be 3–20'; end if;
  if p_timer_seconds is not null and p_timer_seconds not between 30 and 1800 then
    raise exception 'Timer must be between 30 seconds and 30 minutes';
  end if;

  -- Keep only known roles; Knight and Shaman are capped at 1.
  v_counts := jsonb_build_object(
    'villager', greatest(coalesce((p_role_counts->>'villager')::int, 0), 0),
    'shaman',   least(greatest(coalesce((p_role_counts->>'shaman')::int, 0), 0), 1),
    'knight',   least(greatest(coalesce((p_role_counts->>'knight')::int, 0), 0), 1),
    'werewolf', greatest(coalesce((p_role_counts->>'werewolf')::int, 0), 0),
    'madman',   greatest(coalesce((p_role_counts->>'madman')::int, 0), 0)
  );

  update games set
    player_count    = p_player_count,
    role_counts     = v_counts,
    reveal_on_death = coalesce(p_reveal_on_death, false),
    timer_seconds   = p_timer_seconds,
    version         = version + 1,
    updated_at      = now()
  where id = p_game;
end $$;

-- What the join page needs before you have a seat. Reveals no names or roles.
create or replace function public.lookup_game(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  g games;
  v_joined int;
  v_me uuid;
begin
  select * into g from games where code = upper(trim(p_code));
  if not found then return null; end if;
  select count(*) into v_joined from players where game_id = g.id;
  select id into v_me from players where game_id = g.id and user_id = auth.uid();
  return json_build_object(
    'game_id',      g.id,
    'phase',        g.phase,
    'player_count', g.player_count,
    'joined',       v_joined,
    'is_gm',        g.gm_user_id = auth.uid(),
    'my_player_id', v_me
  );
end $$;

-- Idempotent: calling again from the same device returns the same seat.
create or replace function public.join_game(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_joined int;
  v_seat int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into g from games where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No game with that code'; end if;
  if g.gm_user_id = auth.uid() then raise exception 'You are the GM of this game'; end if;

  if exists (select 1 from players where game_id = g.id and user_id = auth.uid()) then
    return g.id;  -- reconnect to existing seat
  end if;

  if g.phase <> 'lobby' then raise exception 'This game has already started'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'Name must be 1–20 characters'; end if;
  if exists (select 1 from players where game_id = g.id and lower(name) = lower(v_name)) then
    raise exception 'That name is already taken';
  end if;

  select count(*), coalesce(max(seat), 0) into v_joined, v_seat from players where game_id = g.id;
  if v_joined >= g.player_count then raise exception 'The lobby is full'; end if;

  insert into players (game_id, user_id, name, seat) values (g.id, auth.uid(), v_name, v_seat + 1);
  perform touch_game(g.id);
  return g.id;
end $$;

-- Milestone 1: lobby only (mid-game kick arrives with GM extras).
create or replace function public.kick_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_game uuid;
  g games;
begin
  select game_id into v_game from players where id = p_player;
  if not found then raise exception 'Player not found'; end if;
  g := lock_game_as_gm(v_game);
  if g.phase <> 'lobby' then raise exception 'Kicking during a game is not available yet'; end if;
  delete from players where id = p_player;
  perform touch_game(v_game);
end $$;

-- Dev helper: fill the empty seats with bots. (The UI only shows it in dev.)
create or replace function public.dev_add_bots(p_game uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_joined int;
  v_seat int;
  v_idx int := 0;
  v_added int := 0;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'lobby' then raise exception 'Bots can only be added in the lobby'; end if;
  select count(*), coalesce(max(seat), 0) into v_joined, v_seat from players where game_id = p_game;
  while v_joined < g.player_count loop
    loop
      v_idx := v_idx + 1;
      exit when not exists (
        select 1 from players where game_id = p_game and lower(name) = lower('Bot ' || v_idx));
    end loop;
    v_seat := v_seat + 1;
    insert into players (game_id, name, seat, is_bot) values (p_game, 'Bot ' || v_idx, v_seat, true);
    v_joined := v_joined + 1;
    v_added := v_added + 1;
  end loop;
  perform touch_game(p_game);
  return v_added;
end $$;

-- ---------- Function permissions ---------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on function
  public.touch_game(uuid), public.gen_game_code(), public.lock_game_as_gm(uuid)
from authenticated;
grant execute on function
  public.is_gm(uuid), public.my_player_id(uuid), public.my_role(uuid),
  public.server_now(), public.create_game(),
  public.update_settings(uuid, int, jsonb, boolean, int),
  public.lookup_game(text), public.join_game(text, text),
  public.kick_player(uuid), public.dev_add_bots(uuid)
to authenticated;
