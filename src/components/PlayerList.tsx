"use client";

import { Skull } from "lucide-react";
import type { Player } from "@/lib/types";

/** Simple roster. `trailing` renders per-row extras (e.g. the GM's kick button). */
export function PlayerList({ players, meId, trailing, emptySeats = 0 }: {
  players: Player[];
  meId?: string | null;
  trailing?: (p: Player) => React.ReactNode;
  emptySeats?: number;
}) {
  return (
    <ul className="divide-y divide-line">
      {players.map((p) => (
        <li key={p.id} className="flex min-h-12 items-center gap-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-line font-display text-sm font-normal tabular-nums">
            {p.seat}
          </span>
          <span className={`min-w-0 flex-1 truncate font-medium ${p.is_alive ? "" : "text-muted line-through decoration-accent"}`}>
            {p.name}
          </span>
          {p.id === meId && (
            <span className="rounded-sm bg-accent px-2 py-0.5 font-display text-xs font-normal tracking-wider text-accent-fg">YOU</span>
          )}
          {!p.is_alive && <Skull className="size-5 text-muted" aria-label="Dead" />}
          {trailing?.(p)}
        </li>
      ))}
      {Array.from({ length: Math.max(0, emptySeats) }, (_, i) => (
        <li key={`empty-${i}`} className="flex min-h-12 items-center gap-3 py-2 text-muted">
          <span className="grid size-8 place-items-center rounded-sm border border-dashed border-line text-sm">
            ·
          </span>
          <span className="italic">An empty seat…</span>
        </li>
      ))}
    </ul>
  );
}
