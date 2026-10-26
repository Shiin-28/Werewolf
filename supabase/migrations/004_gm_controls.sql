-- =====================================================================
-- Werewolf GM Companion — GM controls: pause, end game, back to lobby
-- Paste into Supabase → SQL Editor → Run (after 003_night.sql).
-- Safe to run more than once.
-- =====================================================================

-- Pause freezes every player action (night actions already refuse while paused).
create or replace function public.set_paused(p_game uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase in ('lobby', 'game_over') then raise exception 'There is no game running to pause'; end if;
  update games set paused = p_paused, version = version + 1, updated_at = now() where id = p_game;
end $$;

-- End the game early: everyone sees the Game Over screen with all roles revealed. No winner.
create or replace function public.end_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase in ('lobby', 'game_over') then raise exception 'There is no game running to end'; end if;
  update players p set revealed_role = r.role
  from player_roles r where r.player_id = p.id and p.game_id = p_game;
  update games set
    phase = 'game_over', night_step = null, paused = false, timer_ends_at = null,
    pending_winner = null, winner = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

-- Back to the lobby with the same players seated; all roles and history are wiped.
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
  update players set is_alive = true, seen_role = false, revealed_role = null where game_id = p_game;
  update games set
    phase = 'lobby', round = 0, night_step = null, paused = false, timer_ends_at = null,
    votes_cast = 0, pending_winner = null, winner = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

revoke execute on function
  public.set_paused(uuid, boolean), public.end_game(uuid), public.return_to_lobby(uuid)
from public, anon;
grant execute on function
  public.set_paused(uuid, boolean), public.end_game(uuid), public.return_to_lobby(uuid)
to authenticated;
