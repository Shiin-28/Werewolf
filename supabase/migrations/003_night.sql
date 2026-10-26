-- =====================================================================
-- Werewolf GM Companion — Milestone 3: night phase
-- Paste into Supabase → SQL Editor → Run (after 002_roles.sql).
--
-- Night order: Knight → Shaman → Werewolves → done.
--   * A role that isn't in this game (role_counts = 0) is skipped entirely.
--   * A role that is in the game but dead still gets its step, so nobody can
--     tell who died from the GM's pacing. The GM simply skips it.
--   * Night 1 is for introductions only: each role wakes so the GM can see
--     them and the wolves can see each other. Nobody inspects, protects or kills.
-- Safe to run more than once.
-- =====================================================================

-- Dead wolves stop seeing the pack's kill target (dead players see public info only).
create or replace function public.am_alive(p_game uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_alive from players where game_id = p_game and user_id = auth.uid()), false);
$$;

drop policy if exists night_actions_select on public.night_actions;
create policy night_actions_select on public.night_actions for select to authenticated
  using (
       public.is_gm(game_id)
    or (kind in ('protect', 'inspect') and actor_player_id = public.my_player_id(game_id))
    or (kind = 'kill' and public.my_role(game_id) = 'werewolf' and public.am_alive(game_id))
  );

-- ---------- Step helpers ----------------------------------------------
create or replace function public.next_night_step(p_counts jsonb, p_from public.night_step)
returns public.night_step
language plpgsql immutable as $$
declare
  steps public.night_step[] := array[]::public.night_step[];
begin
  if coalesce((p_counts->>'knight')::int, 0) > 0 then steps := steps || 'knight'::public.night_step; end if;
  if coalesce((p_counts->>'shaman')::int, 0) > 0 then steps := steps || 'shaman'::public.night_step; end if;
  steps := steps || 'wolves'::public.night_step || 'done'::public.night_step;
  if p_from is null then return steps[1]; end if;
  return steps[array_position(steps, p_from) + 1];
end $$;

create or replace function public.step_kind(p_step public.night_step) returns text
language sql immutable as $$
  select case p_step when 'knight' then 'protect' when 'shaman' then 'inspect' when 'wolves' then 'kill' end;
$$;

create or replace function public.step_role(p_step public.night_step) returns public.game_role
language sql immutable as $$
  select case p_step when 'knight' then 'knight'::public.game_role
                     when 'shaman' then 'shaman'::public.game_role
                     when 'wolves' then 'werewolf'::public.game_role end;
$$;

-- ---------- The action itself (shared by players and bots) -------------
-- Caller must hold the game row lock. Returns the Shaman's result ('white'/'black'), else null.
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

-- Bots act as soon as their step begins. Wolves only auto-act if every living wolf is a bot.
create or replace function public.bots_act(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_bot uuid;
  v_target uuid;
begin
  select * into g from games where id = p_game;
  if g.phase <> 'night' or g.night_step is null or g.night_step = 'done' or g.round = 1 then return; end if;

  if g.night_step = 'wolves' then
    if exists (select 1 from players p join player_roles r on r.player_id = p.id
               where p.game_id = p_game and p.is_alive and r.role = 'werewolf' and not p.is_bot) then
      return;  -- a human wolf is awake; let the pack decide
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
    where game_id = p_game and is_alive and (g.night_step <> 'shaman' or id <> v_bot)
    order by random() limit 1;
  end if;

  if v_bot is not null and v_target is not null then
    perform perform_night_action(p_game, v_bot, v_target, true);
  end if;
end $$;

-- ---------- RPCs ---------------------------------------------------------
create or replace function public.begin_night(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase not in ('role_reveal', 'vote_result') then
    raise exception 'The night can only begin after the role reveal or a vote';
  end if;
  if g.pending_winner is not null then raise exception 'The game is over — confirm the winner'; end if;
  update games set
    phase = 'night', round = round + 1, night_step = next_night_step(role_counts, null),
    timer_ends_at = null, votes_cast = 0, version = version + 1, updated_at = now()
  where id = p_game;
  perform bots_act(p_game);
end $$;

-- GM's "Next" / "Skip". p_from guards against double taps: if the step already moved on, nothing happens.
create or replace function public.advance_night_step(p_game uuid, p_from public.night_step) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'night' then raise exception 'It is not night'; end if;
  if g.night_step is distinct from p_from then return; end if;
  if g.night_step = 'done' then raise exception 'The night is over — reveal the morning'; end if;

  -- Close the step. Anything not confirmed counts as skipped (an unlocked wolf proposal = no kill).
  -- Night 1 has no actions to close.
  if g.round > 1 then
    insert into night_actions (game_id, round, kind, locked)
    values (p_game, g.round, step_kind(g.night_step), true)
    on conflict (game_id, round, kind) do update set
      target_player_id = case when night_actions.locked then night_actions.target_player_id end,
      result           = case when night_actions.locked then night_actions.result end,
      locked           = true,
      updated_at       = now();
  end if;

  update games set
    night_step = next_night_step(role_counts, night_step), version = version + 1, updated_at = now()
  where id = p_game;
  perform bots_act(p_game);
end $$;

-- Knight protect / Shaman inspect / Werewolf propose (p_lock = false) or lock in (p_lock = true).
create or replace function public.night_action(p_game uuid, p_target uuid, p_lock boolean default true)
returns text
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  perform 1 from games where id = p_game for update;  -- serialize wolves tapping at once
  if not found then raise exception 'Game not found'; end if;
  v_me := my_player_id(p_game);
  if v_me is null then raise exception 'You are not in this game'; end if;
  return perform_night_action(p_game, v_me, p_target, p_lock);
end $$;

-- GM fix-it: clear the wolves' choice so they can pick again.
create or replace function public.reset_wolf_choice(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'night' or g.night_step <> 'wolves' then
    raise exception 'You can only reset during the werewolves'' turn';
  end if;
  delete from night_actions where game_id = p_game and round = g.round and kind = 'kill';
end $$;

-- ---------- Permissions -----------------------------------------------
revoke execute on function
  public.perform_night_action(uuid, uuid, uuid, boolean), public.bots_act(uuid),
  public.next_night_step(jsonb, public.night_step), public.step_kind(public.night_step),
  public.step_role(public.night_step)
from public, anon, authenticated;
revoke execute on function
  public.am_alive(uuid), public.begin_night(uuid), public.advance_night_step(uuid, public.night_step),
  public.night_action(uuid, uuid, boolean), public.reset_wolf_choice(uuid)
from public, anon;
grant execute on function
  public.am_alive(uuid), public.begin_night(uuid), public.advance_night_step(uuid, public.night_step),
  public.night_action(uuid, uuid, boolean), public.reset_wolf_choice(uuid)
to authenticated;
