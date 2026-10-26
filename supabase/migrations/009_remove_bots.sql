-- =====================================================================
-- Werewolf GM Companion — remove bot players entirely
-- Paste into Supabase → SQL Editor → Run (after 008_three_player_rule.sql).
-- Safe to run more than once.
-- =====================================================================

-- Free the seats bots were holding in lobbies that haven't started.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'players' and column_name = 'is_bot') then
    delete from public.players p using public.games g
    where p.game_id = g.id and p.is_bot and g.phase = 'lobby';
  end if;
end $$;

-- Runs when a night step begins. The only automatic step left is the Shaman's reading.
create or replace function public.night_step_started(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game;
  if g.phase = 'night' and g.night_step = 'shaman' and g.round > 1 then
    perform shaman_reading(p_game);
  end if;
end $$;

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
  perform night_step_started(p_game);
end $$;

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
  perform night_step_started(p_game);
end $$;

create or replace function public.start_voting(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'day' then raise exception 'Voting starts after the discussion'; end if;
  delete from votes where game_id = p_game and round = g.round;
  update games set phase = 'voting', timer_ends_at = null, votes_cast = 0, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

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

  update players set is_alive = true, revealed_role = null, died_at = null, seen_role = false
  where game_id = p_game;
end $$;

-- Nothing references bots any more.
drop function if exists public.dev_add_bots(uuid);
drop function if exists public.bots_vote(uuid);
drop function if exists public.bots_act(uuid);
alter table public.players drop column if exists is_bot;

revoke execute on function public.night_step_started(uuid), public.assign_roles(uuid)
from public, anon, authenticated;
revoke execute on function
  public.begin_night(uuid), public.advance_night_step(uuid, public.night_step), public.start_voting(uuid)
from public, anon;
grant execute on function
  public.begin_night(uuid), public.advance_night_step(uuid, public.night_step), public.start_voting(uuid)
to authenticated;
