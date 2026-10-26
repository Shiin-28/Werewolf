"use client";

import { Trophy } from "lucide-react";
import { useRpc } from "@/hooks/useRpc";
import { TEAMS } from "@/lib/roles";
import { roleOf } from "@/lib/selectors";
import type { Snapshot, Team } from "@/lib/types";
import { BottomBar, Button, Card, Notice } from "@/components/ui";

/** Shown to the GM when the server detects a win. The button is the GM's one confirmation. */
export function WinPanel({ snap, winner }: { snap: Snapshot; winner: Team }) {
  const { busy, error, run } = useRpc();
  const team = TEAMS[winner];
  const living = snap.players.filter((p) => p.is_alive);
  const wolves = living.filter((p) => roleOf(snap, p.id) === "werewolf").length;
  const reason =
    winner === "village"
      ? "Every werewolf is dead."
      : wolves >= living.length - wolves
        ? "The werewolves now equal or outnumber everyone else."
        : "The vote is over, only 3 remain, and no Knight can stop tonight's attack.";

  return (
    <>
      <Card className="border-accent text-center shadow-[0_0_40px_-10px_var(--glow)]">
        <Trophy className="mx-auto size-12 text-accent" aria-hidden />
        <p className="mt-2 font-display text-3xl uppercase tracking-[0.12em]">{team.name} win</p>
        <p className="font-jp text-accent">{team.ja}の勝利</p>
        <p className="mt-2 text-sm text-muted">{reason}</p>
      </Card>
      {error && <Notice tone="error">{error}</Notice>}
      <BottomBar hint="This reveals every role on all screens. Made a mistake? Tap a player in the list to revive them first.">
        <Button big disabled={busy} onClick={() => run("confirm_winner", { p_game: snap.game.id })}>
          <Trophy className="size-6" /> {team.name} win — end game
        </Button>
      </BottomBar>
    </>
  );
}
