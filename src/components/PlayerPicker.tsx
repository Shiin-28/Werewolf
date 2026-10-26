"use client";

import { Check } from "lucide-react";
import type { Player } from "@/lib/types";

/** Big tap targets for choosing one player. `note` adds a small line under a name (e.g. "Ben's pick"). */
export function PlayerPicker({ players, selectedId, onSelect, meId, note, disabled = false }: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  meId?: string;
  note?: (p: Player) => string | null;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => {
        const selected = p.id === selectedId;
        const sub = note?.(p);
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p.id)}
            aria-pressed={selected}
            className={`flex min-h-16 items-center gap-2 rounded-md border px-3 py-2 text-left transition disabled:opacity-50 ${
              selected
                ? "border-accent bg-accent/20 shadow-[0_0_20px_-6px_var(--glow)]"
                : "border-line bg-card/60 hover:border-accent/60"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-medium">
                {p.name}
                {p.id === meId && <span className="ml-1 text-sm text-muted">(you)</span>}
              </span>
              {sub && <span className="block truncate text-xs text-accent">{sub}</span>}
            </span>
            {selected && <Check className="size-5 shrink-0 text-accent" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
