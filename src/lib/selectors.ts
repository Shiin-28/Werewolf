import type { NightAction, NightStep, Player, RoleCounts, RoleId, Snapshot } from "./types";

export function roleOf(snap: Snapshot, playerId: string): RoleId | null {
  return snap.roles.find((r) => r.player_id === playerId)?.role ?? null;
}

/** Werewolves this device is allowed to know about (RLS already filtered the rows), excluding `me`. */
export function knownWolves(snap: Snapshot, me: Player): Player[] {
  const ids = new Set(snap.roles.filter((r) => r.role === "werewolf" && r.player_id !== me.id).map((r) => r.player_id));
  return snap.players.filter((p) => ids.has(p.id));
}

export function playerName(snap: Snapshot, id: string | null | undefined): string {
  return snap.players.find((p) => p.id === id)?.name ?? "—";
}

export const STEP_ROLE: Record<Exclude<NightStep, "done">, RoleId> = {
  knight: "knight",
  fortune: "fortune_teller",
  shaman: "shaman",
  wolves: "werewolf",
};

export const STEP_KIND: Record<Exclude<NightStep, "done">, NightAction["kind"]> = {
  knight: "protect",
  fortune: "inspect",
  shaman: "medium",
  wolves: "kill",
};

/** Tonight's action of a kind, if this device can see it. */
export function tonight(snap: Snapshot, kind: NightAction["kind"]): NightAction | undefined {
  return snap.nightActions.find((a) => a.round === snap.game.round && a.kind === kind);
}

/** The night steps this game has, in order (roles not in the game are skipped). */
export function nightSteps(snap: Snapshot): Exclude<NightStep, "done">[] {
  const c = snap.game.role_counts;
  return [
    ...(c.knight > 0 ? (["knight"] as const) : []),
    ...(c.fortune_teller > 0 ? (["fortune"] as const) : []),
    ...(c.shaman > 0 ? (["shaman"] as const) : []),
    "wolves" as const,
  ];
}

/** Fill in any role missing from older games' role_counts with 0. */
export function normalizeCounts(c: Partial<RoleCounts> | null | undefined): RoleCounts {
  return {
    villager: c?.villager ?? 0,
    fortune_teller: c?.fortune_teller ?? 0,
    shaman: c?.shaman ?? 0,
    knight: c?.knight ?? 0,
    werewolf: c?.werewolf ?? 0,
    madman: c?.madman ?? 0,
  };
}
