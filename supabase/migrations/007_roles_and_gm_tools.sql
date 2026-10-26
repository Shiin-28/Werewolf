-- =====================================================================
-- Werewolf GM Companion — Fortune Teller + Shaman,
-- GM tools (eliminate / revive / kick mid-game)
-- Paste into Supabase → SQL Editor → Run (after 006_new_role_values.sql).
-- Safe to run more than once.
--
-- Roles now:
--   Fortune Teller 占い師  each night picks a player → WHITE / BLACK
--   Shaman 霊媒師          each night automatically learns whether the most
--                          recent person to die was WHITE / BLACK
-- Night order: Knight → Fortune Teller → Shaman → Werewolves.
-- =====================================================================

-- ---------- Schema --------------------------------------------------------
alter table public.players add column if not exists died_at timestamptz;   -- "most recent death" for the Shaman
alter table public.players add column if not exists kicked boolean not null default false;

alter table public.night_actions drop constraint if exists night_actions_kind_check;
alter table public.night_actions add constraint night_actions_kind_check
  check (kind in ('protect', 'inspect', 'medium', 'kill'));

alter table public.games drop constraint if exists games_player_count_check;
alter table public.games add constraint games_player_count_check
  check (player_count between 3 and 20) not valid;
alter table public.games alter column role_counts set default
  '{"villager":2,"fortune_teller":1,"shaman":0,"knight":1,"werewolf":1,"madman":0}';

-- The Shaman sees their own readings like the Knight and Fortune Teller see theirs.
drop policy if exists night_actions_select on public.night_actions;
create policy night_actions_select on public.night_actions for select to authenticated
  using (
       public.is_gm(game_id)
    or (kind in ('protect', 'inspect', 'medium') and actor_player_id = public.my_player_id(game_id))
    or (kind = 'kill' and public.my_role(game_id) = 'werewolf' and public.am_alive(game_id))
  );

-- ---------- Lobby settings: 3–20 players, one Knight / Fortune Teller / Shaman
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

  v_counts := jsonb_build_object(
    'villager',       greatest(coalesce((p_role_counts->>'villager')::int, 0), 0),
    'fortune_teller', least(greatest(coalesce((p_role_counts->>'fortune_teller')::int, 0), 0), 1),
    'shaman',         least(greatest(coalesce((p_role_counts->>'shaman')::int, 0), 0), 1),
    'knight',         least(greatest(coalesce((p_role_counts->>'knight')::int, 0), 0), 1),
    'werewolf',       greatest(coalesce((p_role_counts->>'werewolf')::int, 0), 0),
    'madman',         greatest(coalesce((p_role_counts->>'madman')::int, 0), 0)
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

-- ---------- Dealing roles -----------------------------------------------------
create or replace function public.assign_roles(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  c jsonb;
  v_total int;
  v_joined int;
begin
  select * into g from games where id = p_game;
  c := g.role_counts;
  v_total := coalesce((c->>'villager')::int, 0) + coalesce((c->>'fortune_teller')::int, 0)
           + coalesce((c->>'shaman')::int, 0) + coalesce((c->>'knight')::int, 0)
           + coalesce((c->>'werewolf')::int, 0) + coalesce((c->>'madman')::int, 0);
  select count(*) into v_joined from players where game_id = p_game;

  if v_joined <> g.player_count then
    raise exception 'Waiting for players (% of % joined)', v_joined, g.player_count;
  end if;
  if v_total <> g.player_count then
    raise exception 'Roles (%) must match the player count (%)', v_total, g.player_count;
  end if;
  if coalesce((c->>'werewolf')::int, 0) < 1 then raise exception 'You need at least 1 Werewolf'; end if;
  if coalesce((c->>'knight')::int, 0) > 1 or coalesce((c->>'shaman')::int, 0) > 1
     or coalesce((c->>'fortune_teller')::int, 0) > 1 then
    raise exception 'Only 1 Knight, 1 Fortune Teller and 1 Shaman allowed';
  end if;

  delete from player_roles where game_id = p_game;

  insert into player_roles (player_id, game_id, role)
  select seat.id, p_game, deck.role
  from (
    select id, row_number() over (order by gen_random_uuid()) as n
    from players where game_id = p_game
  ) seat
  join (
    select e.key::game_role as role, row_number() over (order by gen_random_uuid()) as n
    from jsonb_each_text(c) as e(key, value)
    cross join lateral generate_series(1, e.value::int)
  ) deck using (n);

  update players set is_alive = true, revealed_role = null, died_at = null, seen_role = is_bot
  where game_id = p_game;
end $$;

-- Same players, new roles. A kicked seat can't be re-dealt — go back to the lobby instead.
create or replace function public.restart_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase = 'lobby' then raise exception 'The game has not started yet'; end if;
  if exists (select 1 from players where game_id = p_game and kicked) then
    raise exception 'Someone was kicked — go back to the lobby to adjust the players';
  end if;
  delete from night_actions where game_id = p_game;
  delete from votes where game_id = p_game;
  delete from events where game_id = p_game;
  perform assign_roles(p_game);
  update games set
    phase = 'role_reveal', round = 0, night_step = null, paused = false,
    timer_ends_at = null, votes_cast = 0, pending_winner = null, winner = null,
    version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- Back to the lobby; kicked seats are removed so the GM can fill or shrink the table.
create or replace function public.return_to_lobby(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase = 'lobby' then return; end if;
  delete from night_actions where game_id = p_game;
  delete from votes where game_id = p_game;
  delete from events where game_id = p_game;
  delete from player_roles where game_id = p_game;
  delete from players where game_id = p_game and kicked;
  update players set is_alive = true, seen_role = false, revealed_role = null, died_at = null
  where game_id = p_game;
  update games set
    phase = 'lobby', round = 0, night_step = null, paused = false, timer_ends_at = null,
    votes_cast = 0, pending_winner = null, winner = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- ---------- Night steps -----------------------------------------------------
create or replace function public.next_night_step(p_counts jsonb, p_from public.night_step)
returns public.night_step
language plpgsql immutable as $$
declare
  steps public.night_step[] := array[]::public.night_step[];
begin
  if coalesce((p_counts->>'knight')::int, 0) > 0 then steps := steps || 'knight'::public.night_step; end if;
  if coalesce((p_counts->>'fortune_teller')::int, 0) > 0 then steps := steps || 'fortune'::public.night_step; end if;
  if coalesce((p_counts->>'shaman')::int, 0) > 0 then steps := steps || 'shaman'::public.night_step; end if;
  steps := steps || 'wolves'::public.night_step || 'done'::public.night_step;
  if p_from is null then return steps[1]; end if;
  return steps[array_position(steps, p_from) + 1];
end $$;

create or replace function public.step_kind(p_step public.night_step) returns text
language plpgsql immutable as $$
begin
  return case p_step when 'knight' then 'protect' when 'fortune' then 'inspect'
                     when 'shaman' then 'medium' when 'wolves' then 'kill' end;
end $$;

create or replace function public.step_role(p_step public.night_step) returns public.game_role
language plpgsql immutable as $$
begin
  return case p_step when 'knight' then 'knight'::public.game_role
                     when 'fortune' then 'fortune_teller'::public.game_role
                     when 'shaman' then 'shaman'::public.game_role
                     when 'wolves' then 'werewolf'::public.game_role end;
end $$;

-- Kills a player (stamping the time for the Shaman) and reveals the role if the setting says so.
create or replace function public.eliminate_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players p set
    is_alive = false,
    died_at = clock_timestamp(),
    revealed_role = case when g.reveal_on_death then r.role else p.revealed_role end
  from player_roles r, games g
  where p.id = p_player and r.player_id = p.id and g.id = p.game_id;
end $$;

-- The Shaman's automatic reading: the most recent death → WHITE / BLACK (Madman reads WHITE).
create or replace function public.shaman_reading(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_shaman uuid;
  v_dead uuid;
  v_dead_role game_role;
begin
  select * into g from games where id = p_game;
  select p.id into v_shaman from players p join player_roles r on r.player_id = p.id
  where p.game_id = p_game and p.is_alive and r.role = 'shaman';
  if v_shaman is null then return; end if;  -- dead Shaman: the GM calls the step and skips it

  select p.id, r.role into v_dead, v_dead_role from players p join player_roles r on r.player_id = p.id
  where p.game_id = p_game and not p.is_alive and p.died_at is not null
  order by p.died_at desc limit 1;

  insert into night_actions (game_id, round, kind, actor_player_id, target_player_id, result, locked)
  values (p_game, g.round, 'medium', v_shaman, v_dead,
          case when v_dead is null then null when v_dead_role = 'werewolf' then 'black' else 'white' end, true)
  on conflict (game_id, round, kind) do nothing;
end $$;

-- Runs whenever a night step begins: the Shaman's reading, plus dev bots.
create or replace function public.bots_act(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_bot uuid;
  v_target uuid;
begin
  select * into g from games where id = p_game;
  if g.phase <> 'night' or g.night_step is null or g.night_step = 'done' or g.round = 1 then return; end if;

  if g.night_step = 'shaman' then
    perform shaman_reading(p_game);
    return;
  end if;

  if g.night_step = 'wolves' then
    if exists (select 1 from players p join player_roles r on r.player_id = p.id
               where p.game_id = p_game and p.is_alive and r.role = 'werewolf' and not p.is_bot) then
      return;
    end if;
    select p.id into v_bot from players p join player_roles r on r.player_id = p.id
    where p.game_id = p_game and p.is_alive and r.role = 'werewolf' limit 1;
    select p.id into v_target from players p join player_roles r on r.player_id = p.id
    where p.game_id = p_game and p.is_alive and r.role <> 'werewolf' order by random() limit 1;
  else
    select p.id into v_bot from players p join player_roles r on r.player_id = p.id
    where p.game_id = p_game and p.is_alive and p.is_bot and r.role = step_role(g.night_step);
    if v_bot is null then return; end if;
    select id into v_target from players
    where game_id = p_game and is_alive and (g.night_step <> 'fortune' or id <> v_bot)
    order by random() limit 1;
  end if;

  if v_bot is not null and v_target is not null then
    perform perform_night_action(p_game, v_bot, v_target, true);
  end if;
end $$;

create or replace function public.perform_night_action(
  p_game uuid, p_actor uuid, p_target uuid, p_lock boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_actor players;
  v_role game_role;
  v_target players;
  v_target_role game_role;
  v_kind text;
  v_existing night_actions;
  v_result text;
begin
  select * into g from games where id = p_game;
  if g.phase <> 'night' or g.night_step is null or g.night_step = 'done' then
    raise exception 'There is nothing to do right now';
  end if;
  if g.paused then raise exception 'The game is paused'; end if;
  if g.round = 1 then raise exception 'Night 1 is for introductions — no actions tonight'; end if;

  select * into v_actor from players where id = p_actor and game_id = p_game;
  if not found then raise exception 'You are not in this game'; end if;
  if not v_actor.is_alive then raise exception 'You are dead'; end if;
  select role into v_role from player_roles where player_id = p_actor;
  if v_role is distinct from step_role(g.night_step) then raise exception 'It is not your turn'; end if;

  v_kind := step_kind(g.night_step);
  if v_kind = 'medium' then raise exception 'The Shaman''s reading is automatic'; end if;

  select * into v_target from players where id = p_target and game_id = p_game;
  if not found or not v_target.is_alive then raise exception 'Pick a living player'; end if;
  select role into v_target_role from player_roles where player_id = p_target;
  if v_kind = 'inspect' and p_target = p_actor then raise exception 'You cannot inspect yourself'; end if;
  if v_kind = 'kill' and v_target_role = 'werewolf' then raise exception 'Wolves cannot attack wolves'; end if;

  select * into v_existing from night_actions where game_id = p_game and round = g.round and kind = v_kind;
  if found and v_existing.locked then raise exception 'Already decided for tonight'; end if;

  if v_kind = 'inspect' then
    v_result := case when v_target_role = 'werewolf' then 'black' else 'white' end;  -- Madman shows WHITE
  end if;

  insert into night_actions (game_id, round, kind, actor_player_id, target_player_id, result, locked, updated_at)
  values (p_game, g.round, v_kind, p_actor, p_target, v_result, v_kind <> 'kill' or p_lock, now())
  on conflict (game_id, round, kind) do update set
    actor_player_id  = excluded.actor_player_id,
    target_player_id = excluded.target_player_id,
    result           = excluded.result,
    locked           = excluded.locked,
    updated_at       = now();
  return v_result;
end $$;

-- ---------- GM tools ------------------------------------------------------------
-- Fix mistakes: eliminate or revive anyone, then re-check the win.
create or replace function public.gm_set_alive(p_game uuid, p_player uuid, p_alive boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_p players;
begin
  g := lock_game_as_gm(p_game);
  if g.phase in ('lobby', 'game_over') then raise exception 'Only during a game'; end if;
  select * into v_p from players where id = p_player and game_id = p_game;
  if not found then raise exception 'Player not found'; end if;
  if v_p.kicked then raise exception 'Kicked players cannot come back'; end if;
  if v_p.is_alive = p_alive then return; end if;

  if p_alive then
    update players set is_alive = true, died_at = null, revealed_role = null where id = p_player;
  else
    perform eliminate_player(p_player);
  end if;
  insert into events (game_id, kind, round, victim_player_id, tally)
  values (p_game, 'manual', g.round, p_player, jsonb_build_object('alive', p_alive));
  update games set version = version + 1, updated_at = now() where id = p_game;
  perform check_winner(p_game);
end $$;

-- Lobby: remove the seat. Mid-game: counts as a death, and the device loses access to the game.
create or replace function public.kick_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p players;
  g games;
begin
  select * into v_p from players where id = p_player;
  if not found then raise exception 'Player not found'; end if;
  g := lock_game_as_gm(v_p.game_id);

  if g.phase = 'lobby' then
    delete from players where id = p_player;
    perform touch_game(g.id);
    return;
  end if;
  if g.phase = 'game_over' then raise exception 'The game is over'; end if;
  if v_p.kicked then return; end if;

  if v_p.is_alive then perform eliminate_player(p_player); end if;
  update players set user_id = null, kicked = true where id = p_player;
  delete from votes where voter_player_id = p_player and round = g.round;
  insert into events (game_id, kind, round, victim_player_id, tally)
  values (g.id, 'manual', g.round, p_player, jsonb_build_object('kicked', true));
  update games set
    votes_cast = (select count(*) from votes where game_id = g.id and round = g.round),
    version = version + 1, updated_at = now()
  where id = g.id;
  perform check_winner(g.id);
end $$;

-- ---------- Permissions -----------------------------------------------------------
revoke execute on function
  public.assign_roles(uuid), public.next_night_step(jsonb, public.night_step),
  public.step_kind(public.night_step), public.step_role(public.night_step),
  public.eliminate_player(uuid), public.shaman_reading(uuid), public.bots_act(uuid),
  public.perform_night_action(uuid, uuid, uuid, boolean)
from public, anon, authenticated;
revoke execute on function
  public.update_settings(uuid, int, jsonb, boolean, int), public.restart_game(uuid),
  public.return_to_lobby(uuid), public.gm_set_alive(uuid, uuid, boolean), public.kick_player(uuid)
from public, anon;
grant execute on function
  public.update_settings(uuid, int, jsonb, boolean, int), public.restart_game(uuid),
  public.return_to_lobby(uuid), public.gm_set_alive(uuid, uuid, boolean), public.kick_player(uuid)
to authenticated;
