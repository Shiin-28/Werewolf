import { rpc } from "./supabase";
import type { Phase } from "./types";

export interface Lookup {
  game_id: string;
  phase: Phase;
  player_count: number;
  joined: number;
  is_gm: boolean;
  my_player_id: string | null;
}

/** Joins (or rejoins) a game and returns the screen to go to. Throws a readable error otherwise. */
export async function enterGame(code: string, nickname: string): Promise<string> {
  const lookup = await rpc<Lookup | null>("lookup_game", { p_code: code });
  if (!lookup) throw new Error(`No game with code ${code}`);
  if (lookup.is_gm) return `/gm/${code}`;
  if (lookup.my_player_id) return `/play/${code}`;
  if (lookup.phase !== "lobby") throw new Error("This game has already started");
  await rpc("join_game", { p_code: code, p_name: nickname });
  return `/play/${code}`;
}
