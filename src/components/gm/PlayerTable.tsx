"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, HeartPulse, Skull, UserX } from "lucide-react";
import { useRpc } from "@/hooks/useRpc";
import { roleOf } from "@/lib/selectors";
import type { Player, Snapshot } from "@/lib/types";
import { Button, Card, Notice } from "@/components/ui";
import { RoleBadge } from "@/components/RoleBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { useGm } from "./GmContext";

/**
 * GM's master list: every player with their secret role. Roles can be blurred if players are nearby.
 * During a game, tapping a player opens fix-it tools (eliminate / revive / kick).
 */
export function PlayerTable({ snap, showSeen = false }: { snap: Snapshot; showSeen?: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { busy, error, run } = useRpc();
  const [confirm, dialog] = useConfirm();
  const { broadcastRefresh } = useGm();
  const editable = !["lobby", "game_over"].includes(snap.game.phase);

  async function setAlive(p: Player, alive: boolean) {
    const ok = await confirm({
      title: alive ? `Revive ${p.name}?` : `Eliminate ${p.name}?`,
      message: alive
        ? "Use this to fix a mistake. They can act and vote again. The win check runs again."
        : "Use this to fix a mistake. They die immediately; the win check runs again.",
      confirmLabel: alive ? "Revive" : "Eliminate",
      danger: !alive,
    });
    if (!ok) return;
    await run("gm_set_alive", { p_game: snap.game.id, p_player: p.id, p_alive: alive });
    setOpenId(null);
  }

  async function kick(p: Player) {
    const ok = await confirm({
      title: `Kick ${p.name}?`,
      message: "They are removed from the game: it counts as a death and their device loses access.",
      confirmLabel: "Kick",
      danger: true,
    });
    if (!ok) return;
    await run("kick_player", { p_player: p.id });
    broadcastRefresh();
    setOpenId(null);
  }

  return (
    <Card title="Players & roles" ja="役職一覧">
      {dialog}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {hidden ? "Show roles" : "Hide roles from onlookers"}
        </button>
        {editable && <span className="text-xs text-muted">Tap a player to fix mistakes</span>}
      </div>
      <ul className="divide-y divide-line">
        {snap.players.map((p) => {
          const role = roleOf(snap, p.id);
          const open = openId === p.id;
          return (
            <li key={p.id} className="py-2">
              <button
                type="button"
                disabled={!editable}
                onClick={() => setOpenId(open ? null : p.id)}
                aria-expanded={editable ? open : undefined}
                className="flex min-h-12 w-full items-center gap-3 text-left disabled:cursor-default"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-line font-display text-sm tabular-nums">
                  {p.seat}
                </span>
                <span className={`min-w-0 flex-1 truncate font-medium ${p.is_alive ? "" : "text-muted line-through decoration-accent"}`}>
                  {p.name}
                  {p.kicked && <span className="ml-2 text-xs uppercase text-accent no-underline">kicked</span>}
                </span>
                {/* Hidden = identical neutral chip for everyone: a blur would still leak the role's colour. */}
                {role &&
                  (hidden ? (
                    <span className="inline-flex h-7 w-28 items-center justify-center rounded-sm border border-line bg-line/40 text-xs tracking-[0.3em] text-muted">
                      ••••••
                    </span>
                  ) : (
                    <RoleBadge role={role} />
                  ))}
                {!p.is_alive && <Skull className="size-5 text-muted" aria-label="Dead" />}
                {showSeen && (
                  <span
                    className={`grid size-7 place-items-center rounded-sm ${p.seen_role ? "text-emerald-500" : "text-muted"}`}
                    title={p.seen_role ? "Has seen role" : "Hasn't looked yet"}
                  >
                    {p.seen_role ? <Check className="size-5" /> : "…"}
                  </span>
                )}
              </button>
              {open && editable && (
                <div className="mt-2 grid grid-cols-2 gap-2 pl-11">
                  {p.is_alive ? (
                    <Button variant="danger" disabled={busy} onClick={() => setAlive(p, false)}>
                      <Skull className="size-4" /> Eliminate
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled={busy || p.kicked} onClick={() => setAlive(p, true)}>
                      <HeartPulse className="size-4" /> Revive
                    </Button>
                  )}
                  <Button variant="secondary" disabled={busy || p.kicked} onClick={() => kick(p)}>
                    <UserX className="size-4" /> Kick
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}
