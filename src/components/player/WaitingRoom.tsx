"use client";

import { Hourglass } from "lucide-react";
import type { Player, Snapshot } from "@/lib/types";
import { Card } from "@/components/ui";
import { PlayerList } from "@/components/PlayerList";

export function WaitingRoom({ snap, me }: { snap: Snapshot; me: Player }) {
  const { game, players } = snap;
  return (
    <>
      <Card className="text-center">
        <Hourglass className="mx-auto size-10 animate-flicker text-accent" aria-hidden />
        <p className="mt-2 text-muted">You&apos;re in as</p>
        <p className="font-display text-3xl font-normal uppercase tracking-[0.1em]">{me.name}</p>
        <p className="mt-3 font-semibold">The village gathers. Wait for the GM to begin.</p>
        <p className="font-jp text-sm text-muted">ゲーム開始を待っています</p>
      </Card>
      <Card title={`Players ${players.length}/${game.player_count}`} ja="参加者">
        <PlayerList players={players} meId={me.id} emptySeats={game.player_count - players.length} />
      </Card>
    </>
  );
}
