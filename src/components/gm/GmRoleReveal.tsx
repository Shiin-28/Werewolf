"use client";

import { useState } from "react";
import { Moon, Shuffle } from "lucide-react";
import { rpc } from "@/lib/supabase";
import type { Snapshot } from "@/lib/types";
import { BottomBar, Button, Card, Notice } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { PlayerTable } from "./PlayerTable";

export function GmRoleReveal({ snap }: { snap: Snapshot }) {
  const { game, players } = snap;
  const [confirm, dialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = players.filter((p) => !p.seen_role);

  async function beginNight() {
    if (waiting.length > 0) {
      const ok = await confirm({
        title: "Begin the night anyway?",
        message: `${waiting.map((p) => p.name).join(", ")} ${waiting.length === 1 ? "hasn't" : "haven't"} looked at their role yet.`,
        confirmLabel: "Begin night",
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await rpc("begin_night", { p_game: game.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reshuffle() {
    const ok = await confirm({
      title: "Deal new roles?",
      message: "Everyone gets a new random role and must check their card again.",
      confirmLabel: "Reshuffle",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await rpc("restart_game", { p_game: game.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {dialog}
      <Card className="text-center">
        <p className="font-display text-xl uppercase tracking-[0.12em]">Roles have been dealt</p>
        <p className="text-sm text-muted">Tell everyone to check their card in secret.</p>
        <p className="mt-3 font-display text-3xl tabular-nums">
          {players.length - waiting.length}/{players.length}
        </p>
        <p className="text-sm text-muted">have seen their role</p>
        {waiting.length > 0 && (
          <p className="mt-2 text-sm">Still looking: {waiting.map((p) => p.name).join(", ")}</p>
        )}
      </Card>

      <PlayerTable snap={snap} showSeen />

      <Button variant="secondary" disabled={busy} onClick={reshuffle}>
        <Shuffle className="size-5" /> Reshuffle roles
      </Button>
      {error && <Notice tone="error">{error}</Notice>}

      <BottomBar>
        <Button big disabled={busy} onClick={beginNight}>
          <Moon className="size-6" /> Begin Night 1
        </Button>
        <p className="mt-1 text-center text-sm text-muted">
          {waiting.length ? `${waiting.length} still looking at their card` : "Everyone is ready"}
        </p>
      </BottomBar>
    </>
  );
}
