-- =====================================================================
-- Werewolf GM Companion — private pack chat for the werewolves
-- Paste into Supabase → SQL Editor → Run (after 009_remove_bots.sql).
-- Safe to run more than once.
--
-- * Readable by living werewolves, the GM, and dead players (spectators).
--   Living non-wolves — the Madman included — never receive it (RLS, so
--   realtime doesn't deliver it to them either).
-- * Writable only by living werewolves during the werewolves' turn at night,
--   and only while at least 2 wolves are alive (a lone wolf has no one to talk to).
-- =====================================================================

create table if not exists public.wolf_messages (
  id               bigint generated always as identity primary key,
  game_id          uuid not null references public.games on delete cascade,
  round            int  not null,
  sender_player_id uuid references public.players on delete set null,
  body             text not null check (char_length(body) between 1 and 200),
  created_at       timestamptz not null default now()
);
create index if not exists wolf_messages_game_idx on public.wolf_messages (game_id, id);

alter table public.wolf_messages enable row level security;
revoke insert, update, delete, truncate on public.wolf_messages from anon, authenticated;

drop policy if exists wolf_messages_select on public.wolf_messages;
create policy wolf_messages_select on public.wolf_messages for select to authenticated
  using (
       public.is_gm(game_id)
    or (public.my_role(game_id) = 'werewolf' and public.am_alive(game_id))
    or (public.my_player_id(game_id) is not null and not public.am_alive(game_id))  -- dead spectators
  );

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wolf_messages') then
    alter publication supabase_realtime add table public.wolf_messages;
  end if;
end $$;

create or replace function public.send_wolf_message(p_game uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_me uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into g from games where id = p_game;
  if not found then raise exception 'Game not found'; end if;
  v_me := my_player_id(p_game);
  if v_me is null then raise exception 'You are not in this game'; end if;
  if my_role(p_game) is distinct from 'werewolf' then raise exception 'Only werewolves can use this chat'; end if;
  if not am_alive(p_game) then raise exception 'You are dead'; end if;
  if g.phase <> 'night' or g.night_step is distinct from 'wolves' then
    raise exception 'The pack can only talk during the werewolves'' turn';
  end if;
  if g.paused then raise exception 'The game is paused'; end if;
  if (select count(*) from players p join player_roles r on r.player_id = p.id
      where p.game_id = p_game and p.is_alive and r.role = 'werewolf') < 2 then
    raise exception 'You hunt alone — there is no pack to talk to';
  end if;
  if char_length(v_body) not between 1 and 200 then raise exception 'Messages must be 1–200 characters'; end if;

  insert into wolf_messages (game_id, round, sender_player_id, body) values (p_game, g.round, v_me, v_body);
end $$;

-- A new deal or a return to the lobby wipes the pack's old conversation.
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
  delete from wolf_messages where game_id = p_game;
  perform assign_roles(p_game);
  update games set
    phase = 'role_reveal', round = 0, night_step = null, paused = false,
    timer_ends_at = null, votes_cast = 0, pending_winner = null, winner = null,
    version = version + 1, updated_at = now()
  where id = p_game;
end $$;

create or replace function public.return_to_lobby(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g games;
begin
  g := lock_game_as_gm(p_game);
  if g.phase = 'lobby' then return; end if;
  delete from night_actions where game_id = p_game;
  delete from votes where game_id = p_game;
  delete from events where game_id = p_game;
  delete from wolf_messages where game_id = p_game;
  delete from player_roles where game_id = p_game;
  delete from players where game_id = p_game and kicked;
  update players set is_alive = true, seen_role = false, revealed_role = null, died_at = null
  where game_id = p_game;
  update games set
    phase = 'lobby', round = 0, night_step = null, paused = false, timer_ends_at = null,
    votes_cast = 0, pending_winner = null, winner = null, version = version + 1, updated_at = now()
  where id = p_game;
end $$;

revoke execute on function
  public.send_wolf_message(uuid, text), public.restart_game(uuid), public.return_to_lobby(uuid)
from public, anon;
grant execute on function
  public.send_wolf_message(uuid, text), public.restart_game(uuid), public.return_to_lobby(uuid)
to authenticated;
