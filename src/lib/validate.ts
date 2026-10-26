import { ROLES, ROLE_ORDER } from "./roles";
import type { RoleCounts } from "./types";

export function roleTotal(counts: RoleCounts): number {
  return ROLE_ORDER.reduce((sum, r) => sum + (counts[r] ?? 0), 0);
}

export function validateSetup(playerCount: number, counts: RoleCounts) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const total = roleTotal(counts);
  const wolves = counts.werewolf ?? 0;

  if (total !== playerCount) {
    const diff = playerCount - total;
    errors.push(
      diff > 0
        ? `Add ${diff} more role${diff === 1 ? "" : "s"} (${total}/${playerCount}).`
        : `Remove ${-diff} role${diff === -1 ? "" : "s"} (${total}/${playerCount}).`,
    );
  }
  if (wolves < 1) errors.push("You need at least 1 Werewolf.");
  for (const r of ROLE_ORDER) {
    const max = ROLES[r].max;
    if (max !== undefined && counts[r] > max) errors.push(`Only ${max} ${ROLES[r].name} allowed.`);
  }
  if (wolves > 0 && wolves * 2 >= playerCount) {
    warnings.push("Werewolves are half or more of the players — they would win right away.");
  }
  return { errors, warnings, total, ok: errors.length === 0 };
}
