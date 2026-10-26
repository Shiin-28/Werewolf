export type Phase =
  | "lobby" | "role_reveal" | "night" | "morning" | "day" | "voting" | "vote_result" | "game_over";
export type NightStep = "knight" | "fortune" | "shaman" | "wolves" | "done";
export type RoleId = "villager" | "fortune_teller" | "shaman" | "knight" | "werewolf" | "madman";
export type Team = "village" | "werewolf";
export type RoleCounts = Record<RoleId, number>;

export interface Game {
  id: string;
  code: string;
  gm_user_id: string;
  phase: Phase;
  night_step: NightStep | null;
  round: number;
  paused: boolean;
  player_count: number;
  role_counts: RoleCounts;
  reveal_on_death: boolean;
  timer_seconds: number | null;
  timer_ends_at: string | null;
  votes_cast: number;
  pending_winner: Team | null;
  winner: Team | null;
  version: number;
}

export interface Player {
  id: string;
  game_id: string;
  user_id: string | null;
  name: string;
  seat: number;
  is_alive: boolean;
  seen_role: boolean;
  revealed_role: RoleId | null;
  died_at: string | null;
  kicked: boolean;
}

export interface GameEvent {
  id: number;
  game_id: string;
  kind: "morning" | "vote" | "manual";
  round: number;
  victim_player_id: string | null;
  tally: Record<string, number> | null;
}

export interface PlayerRole {
  player_id: string;
  game_id: string;
  role: RoleId;
}

export interface NightAction {
  game_id: string;
  round: number;
  kind: "protect" | "inspect" | "medium" | "kill";
  actor_player_id: string | null;
  target_player_id: string | null;
  result: "white" | "black" | null;
  locked: boolean;
}

export interface Vote {
  game_id: string;
  round: number;
  voter_player_id: string;
  target_player_id: string | null;
}

export interface WolfMessage {
  id: number;
  game_id: string;
  round: number;
  sender_player_id: string | null;
  body: string;
  created_at: string;
}

/** Everything this device is allowed to see (RLS decides). */
export interface Snapshot {
  game: Game;
  players: Player[];
  events: GameEvent[];
  roles: PlayerRole[];
  nightActions: NightAction[];
  votes: Vote[];
  /** Pack chat: only living wolves, dead spectators and the GM receive rows. */
  wolfMessages: WolfMessage[];
}
