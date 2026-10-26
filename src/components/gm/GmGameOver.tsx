"use client";

import { useState } from "react";
import { DoorOpen, Shuffle } from "lucide-react";
import { rpc } from "@/lib/supabase";
import type { Snapshot } from "@/lib/types";
import { BottomBar, Button, Notice } from "@/components/ui";
import { GameOverScreen } from "@/components/GameOverScreen";

export function GmGameOver({ snap }: { snap: Snapshot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: string) {
    setBusy(true);
    setError(null);
    try {
      await rpc(fn, { p_game: snap.game.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GameOverScreen snap={snap} />
      {error && <Notice tone="error">{error}</Notice>}
      <BottomBar>
        <Button big disabled={busy} onClick={() => run("restart_game")}>
          <Shuffle className="size-6" /> Play again — new roles
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => run("return_to_lobby")}>
          <DoorOpen className="size-5" /> Back to lobby (change setup)
        </Button>
      </BottomBar>
    </>
  );
}
