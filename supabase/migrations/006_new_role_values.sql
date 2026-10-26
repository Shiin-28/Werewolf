-- =====================================================================
-- Werewolf GM Companion — new role / night-step names
-- Run this file ON ITS OWN (its own "Run"), before 007.
-- Postgres requires new enum values to be committed before anything uses them.
-- Safe to run more than once.
-- =====================================================================

-- Fortune Teller 占い師: inspects a player each night (what the Shaman used to do).
alter type public.game_role add value if not exists 'fortune_teller';

-- Night step for the Fortune Teller. The existing 'shaman' step is now the
-- Shaman 霊媒師's automatic reading of the most recent death.
alter type public.night_step add value if not exists 'fortune' before 'shaman';
