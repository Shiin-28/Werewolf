-- =====================================================================
-- Werewolf GM Companion — Milestone 4 (+ win check): morning, day, voting
-- Paste into Supabase → SQL Editor → Run (after 004_gm_controls.sql).
-- Safe to run more than once.
--
-- Flow: night(done) → morning → day (discussion + optional timer)
--       → voting → vote_result → next night … until someone wins.
-- =====================================================================

-- ---------- Internal helpers -------------------------------------------

-- Kills a player; reveals their role publicly if the game's setting says so.
create or replace function public.eliminate_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players p set
    is_alive = false,
    revealed_role = case when g.reveal_on_death then r.role else p.revealed_role end
  from player_roles r, games g
  where p.id = p_player and r.player_id = p.id and g.id = p.game_id;
end $$;

-- Village wins when no wolves are left; wolves win when they are at least half of the living.
-- The Madman counts as a non-wolf here (he still wins with the wolves).
create or replace function public.check_winner(p_game uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_wolves int;
  v_others int;
  v_winner text;
begin
  select count(*) filter (where r.role = 'werewolf'), count(*) filter (where r.role <> 'werewolf')
  into v_wolves, v_others
  from players p join player_roles r on r.player_id = p.id
  where p.game_id = p_game and p.is_alive;

  v_winner := case when v_wolves = 0 then 'village' when v_wolves >= v_others then 'werewolf' end;
  update games set pending_winner = v_winner where id = p_game;
  return v_winner;
end $$;

-- Bots vote for a random living player (never themselves).
create or replace function public.bots_vote(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_bot record;
begin
  select * into g from games where id = p_game;
  for v_bot in select id from players where game_id = p_game and is_alive and is_bot loop
    insert into votes (game_id, round, voter_player_id, target_player_id)
    select p_game, g.round, v_bot.id, id from players
    where game_id = p_game and is_alive and id <> v_bot.id
    order by random() limit 1
    on conflict (game_id, round, voter_player_id) do nothing;
  end loop;
  update games set votes_cast = (select count(*) from votes where game_id = p_game and round = g.round)
  where id = p_game;
end $$;

-- ---------- Morning ------------------------------------------------------
create or replace function public.reveal_morning(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_kill uuid;
  v_protect uuid;
  v_victim uuid;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'night' or g.night_step is distinct from 'done' then raise exception 'Finish the night first'; end if;
  if g.paused then raise exception 'The game is paused'; end if;

  select target_player_id into v_kill from night_actions
  where game_id = p_game and round = g.round and kind = 'kill' and locked;
  select target_player_id into v_protect from night_actions
  where game_id = p_game and round = g.round and kind = 'protect';

  if v_kill is not null and v_kill is distinct from v_protect then
    v_victim := v_kill;
    perform eliminate_player(v_victim);
  end if;

  -- Public announcement. A Knight save looks exactly like a quiet night.
  insert into events (game_id, kind, round, victim_player_id) values (p_game, 'morning', g.round, v_victim);
  update games set phase = 'morning', night_step = null, version = version + 1, updated_at = now()
  where id = p_game;
  perform check_winner(p_game);
end $$;

-- ---------- Day: discussion + timer ---------------------------------------
create or replace function public.start_discussion(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'morning' then raise exception 'Reveal the morning first'; end if;
  if g.pending_winner is not null then raise exception 'The game is over — confirm the winner'; end if;
  update games set phase = 'day', timer_ends_at = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- Starts (or restarts) the countdown. Everyone's screen counts down to the same moment.
create or replace function public.start_timer(p_game uuid, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'day' then raise exception 'The timer is only for the day discussion'; end if;
  if p_seconds not between 10 and 3600 then raise exception 'Timer must be 10 seconds to 60 minutes'; end if;
  update games set timer_ends_at = now() + make_interval(secs => p_seconds), version = version + 1, updated_at = now()
  where id = p_game;
end $$;

create or replace function public.stop_timer(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  update games set timer_ends_at = null, version = version + 1, updated_at = now() where id = p_game;
end $$;

-- ---------- Voting -------------------------------------------------------
create or replace function public.start_voting(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'day' then raise exception 'Voting starts after the discussion'; end if;
  delete from votes where game_id = p_game and round = g.round;
  update games set phase = 'voting', timer_ends_at = null, votes_cast = 0, version = version + 1, updated_at = now()
  where id = p_game;
  perform bots_vote(p_game);
end $$;

-- p_target = null means Skip. Players may change their vote until the GM ends voting.
create or replace function public.cast_vote(p_game uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_me players;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'Game not found'; end if;
  if g.phase <> 'voting' then raise exception 'Voting is not open'; end if;
  if g.paused then raise exception 'The game is paused'; end if;
  select * into v_me from players where game_id = p_game and user_id = auth.uid();
  if not found then raise exception 'You are not in this game'; end if;
  if not v_me.is_alive then raise exception 'Dead players cannot vote'; end if;
  if p_target is not null then
    if p_target = v_me.id then raise exception 'You cannot vote for yourself'; end if;
    if not exists (select 1 from players where id = p_target and game_id = p_game and is_alive) then
      raise exception 'Vote for a living player';
    end if;
  end if;

  insert into votes (game_id, round, voter_player_id, target_player_id, updated_at)
  values (p_game, g.round, v_me.id, p_target, now())
  on conflict (game_id, round, voter_player_id) do update set
    target_player_id = excluded.target_player_id, updated_at = now();

  update games set
    votes_cast = (select count(*) from votes where game_id = p_game and round = g.round),
    version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- Most votes is eliminated. A tie, or Skip on top, eliminates nobody.
create or replace function public.end_voting(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_tally jsonb;
  v_top text;
  v_top_n int;
  v_ties int;
  v_victim uuid;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'voting' then raise exception 'Voting is not open'; end if;

  with counts as (
    select coalesce(v.target_player_id::text, 'skip') as k, count(*)::int as n
    from votes v join players p on p.id = v.voter_player_id
    where v.game_id = p_game and v.round = g.round and p.is_alive
    group by 1
  )
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb),
         (select k from counts order by n desc limit 1),
         (select max(n) from counts),
         (select count(*) from counts where n = (select max(n) from counts))
  into v_tally, v_top, v_top_n, v_ties
  from counts;

  if v_top is not null and v_top <> 'skip' and v_ties = 1 then
    v_victim := v_top::uuid;
    perform eliminate_player(v_victim);
  end if;

  insert into events (game_id, kind, round, victim_player_id, tally)
  values (p_game, 'vote', g.round, v_victim, v_tally);
  update games set phase = 'vote_result', version = version + 1, updated_at = now() where id = p_game;
  perform check_winner(p_game);
end $$;

-- ---------- Game over ------------------------------------------------------
-- GM confirms the win the server detected: everyone sees the winner and all roles.
create or replace function public.confirm_winner(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.pending_winner is null then raise exception 'Nobody has won yet'; end if;
  update players p set revealed_role = r.role
  from player_roles r where r.player_id = p.id and p.game_id = p_game;
  update games set
    phase = 'game_over', winner = pending_winner, pending_winner = null, night_step = null,
    paused = false, timer_ends_at = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- ---------- Permissions ----------------------------------------------------
revoke execute on function
  public.eliminate_player(uuid), public.check_winner(uuid), public.bots_vote(uuid)
from public, anon, authenticated;
revoke execute on function
  public.reveal_morning(uuid), public.start_discussion(uuid), public.start_timer(uuid, int),
  public.stop_timer(uuid), public.start_voting(uuid), public.cast_vote(uuid, uuid),
  public.end_voting(uuid), public.confirm_winner(uuid)
from public, anon;
grant execute on function
  public.reveal_morning(uuid), public.start_discussion(uuid), public.start_timer(uuid, int),
  public.stop_timer(uuid), public.start_voting(uuid), public.cast_vote(uuid, uuid),
  public.end_voting(uuid), public.confirm_winner(uuid)
to authenticated;
