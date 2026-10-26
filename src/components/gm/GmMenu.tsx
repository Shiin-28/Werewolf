"use client";

import { useEffect, useRef, useState } from "react";
import { DoorOpen, EllipsisVertical, Pause, Play, Square } from "lucide-react";
import { rpc } from "@/lib/supabase";
import type { Game } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmDialog";

/** GM's ⋮ menu: pause/resume, end the game, back to lobby. */
export function GmMenu({ game, onError }: { game: Game; onError: (msg: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();
  const ref = useRef<HTMLDivElement>(null);
  const running = game.phase !== "lobby" && game.phase !== "game_over";

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function run(fn: string, args: Record<string, unknown> = {}) {
    setOpen(false);
    setBusy(true);
    onError(null);
    try {
      await rpc(fn, { p_game: game.id, ...args });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function endGame() {
    setOpen(false);
    const ok = await confirm({
      title: "End the game now?",
      message: "Every player sees the Game Over screen with all roles revealed. There is no winner.",
      confirmLabel: "End game",
      danger: true,
    });
    if (ok) await run("end_game");
  }

  async function toLobby() {
    setOpen(false);
    const ok = await confirm({
      title: "Back to the lobby?",
      message: "The game ends and everyone returns to the lobby with the same seats. Roles and history are wiped.",
      confirmLabel: "Back to lobby",
      danger: true,
    });
    if (ok) await run("return_to_lobby");
  }

  if (game.phase === "lobby") return null;

  const item =
    "flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-accent/15 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div ref={ref} className="relative">
      {dialog}
      <button
        type="button"
        aria-label="Game controls"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-md border border-line hover:border-accent hover:text-accent"
      >
        <EllipsisVertical className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-md border border-accent/50 bg-card py-1 shadow-[0_12px_40px_-8px_rgb(0_0_0/0.9)]">
          {running && (
            <button type="button" className={item} onClick={() => run("set_paused", { p_paused: !game.paused })}>
              {game.paused ? <Play className="size-5 text-accent" /> : <Pause className="size-5 text-accent" />}
              {game.paused ? "Resume game" : "Pause game"}
            </button>
          )}
          {running && (
            <button type="button" className={item} onClick={endGame}>
              <Square className="size-5 text-accent" /> End game
            </button>
          )}
          <button type="button" className={item} onClick={toLobby}>
            <DoorOpen className="size-5 text-accent" /> Back to lobby
          </button>
        </div>
      )}
    </div>
  );
}
