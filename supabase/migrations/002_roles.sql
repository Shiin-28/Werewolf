-- =====================================================================
-- Werewolf GM Companion — Milestone 2: role assignment & reveal
-- Paste into Supabase → SQL Editor → Run (after 001_lobby.sql).
-- =====================================================================

-- Deals a fresh random deck of roles to every seat. Internal: callers lock the game first.
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
  v_total := coalesce((c->>'villager')::int, 0) + coalesce((c->>'shaman')::int, 0)
           + coalesce((c->>'knight')::int, 0) + coalesce((c->>'werewolf')::int, 0)
           + coalesce((c->>'madman')::int, 0);
  select count(*) into v_joined from players where game_id = p_game;

  if v_joined <> g.player_count then
    raise exception 'Waiting for players (% of % joined)', v_joined, g.player_count;
  end if;
  if v_total <> g.player_count then
    raise exception 'Roles (%) must match the player count (%)', v_total, g.player_count;
  end if;
  if coalesce((c->>'werewolf')::int, 0) < 1 then raise exception 'You need at least 1 Werewolf'; end if;
  if coalesce((c->>'knight')::int, 0) > 1 or coalesce((c->>'shaman')::int, 0) > 1 then
    raise exception 'Only 1 Knight and 1 Shaman allowed';
  end if;

  delete from player_roles where game_id = p_game;

  -- Shuffle seats and the deck independently (gen_random_uuid is cryptographically random), then pair them up.
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

  -- Everyone alive and unrevealed; bots don't need to look at their card.
  update players set is_alive = true, revealed_role = null, seen_role = is_bot
  where game_id = p_game;
end $$;

create or replace function public.start_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase <> 'lobby' then raise exception 'The game has already started'; end if;
  perform assign_roles(p_game);
  update games set
    phase = 'role_reveal', round = 0, night_step = null, paused = false,
    timer_ends_at = null, votes_cast = 0, pending_winner = null, winner = null,
    version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- Same players, new roles. Wipes all game history.
create or replace function public.restart_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase = 'lobby' then raise exception 'The game has not started yet'; end if;
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

-- A player tells the GM they've looked at their card.
create or replace function public.mark_role_seen(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players set seen_role = true
  where game_id = p_game and user_id = auth.uid() and not seen_role;
end $$;

revoke execute on function public.assign_roles(uuid) from public, anon, authenticated;
revoke execute on function public.start_game(uuid), public.restart_game(uuid), public.mark_role_seen(uuid)
  from public, anon;
grant execute on function public.start_game(uuid), public.restart_game(uuid), public.mark_role_seen(uuid)
  to authenticated;
