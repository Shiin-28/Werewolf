-- =====================================================================
-- Werewolf GM Companion — house rule: after the vote, 3 left, 1 wolf, no Knight = wolves win
-- Paste into Supabase → SQL Editor → Run (after 007_roles_and_gm_tools.sql).
-- Safe to run more than once.
-- =====================================================================

-- Village wins when no wolves are left.
-- Wolves win when they equal or outnumber everyone else (the Madman counts as "everyone else").
-- House rule: once the day's vote is over (vote result / the night after), if only 3 remain,
-- 1 of them a wolf, and no living Knight can protect anyone, the coming attack can't be
-- stopped and leaves 1 vs 1 — so the wolves win right away. Before the vote (morning, day,
-- voting) the village can still vote the wolf out, so the game goes on.
create or replace function public.check_winner(p_game uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  g games;
  v_wolves int;
  v_others int;
  v_knights int;
  v_winner text;
begin
  select * into g from games where id = p_game;

  select count(*) filter (where r.role = 'werewolf'),
         count(*) filter (where r.role <> 'werewolf'),
         count(*) filter (where r.role = 'knight')
  into v_wolves, v_others, v_knights
  from players p join player_roles r on r.player_id = p.id
  where p.game_id = p_game and p.is_alive;

  v_winner := case
    when v_wolves = 0 then 'village'
    when v_wolves >= v_others then 'werewolf'
    when v_wolves = 1 and v_wolves + v_others = 3 and v_knights = 0
         and g.phase in ('vote_result', 'night') then 'werewolf'
  end;
  update games set pending_winner = v_winner where id = p_game;
  return v_winner;
end $$;

revoke execute on function public.check_winner(uuid) from public, anon, authenticated;
