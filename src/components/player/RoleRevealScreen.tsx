"use client";

import { rpc } from "@/lib/supabase";
import { knownWolves, roleOf } from "@/lib/selectors";
import type { Player, Snapshot } from "@/lib/types";
import { Card, Notice } from "@/components/ui";
import { RoleCard } from "./RoleCard";

export function RoleRevealScreen({ snap, me }: { snap: Snapshot; me: Player }) {
  const role = roleOf(snap, me.id);
  const seen = snap.players.filter((p) => p.seen_role).length;

  if (!role) return <Notice>Dealing roles…</Notice>;

  return (
    <>
      <RoleCard
        role={role}
        wolves={knownWolves(snap, me)}
        madmenInGame={snap.game.role_counts.madman}
        onFirstReveal={() => {
          if (!me.seen_role) void rpc("mark_role_seen", { p_game: snap.game.id }).catch(() => {});
        }}
      />
      <Card className="text-center">
        <p className="font-display text-lg uppercase tracking-[0.12em]">
          {me.seen_role ? "Wait for nightfall" : "Check your role"}
        </p>
        <p className="text-sm text-muted">
          {me.seen_role
            ? "When everyone has looked, the GM will begin Night 1."
            : "Tap the card. Keep your role secret."}
        </p>
        <p className="mt-2 text-sm text-muted">
          {seen}/{snap.players.length} have checked their role
        </p>
      </Card>
    </>
  );
}
