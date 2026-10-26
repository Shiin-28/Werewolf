import { Skull } from "lucide-react";
import type { Player } from "@/lib/types";
import { RoleBadge } from "./RoleBadge";

/** Every player with their (publicly revealed) role — used on the Game Over screen. */
export function RevealList({ players, meId }: { players: Player[]; meId?: string }) {
  return (
    <ul className="divide-y divide-line">
      {players.map((p) => (
        <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
          <span className={`min-w-0 flex-1 truncate font-medium ${p.is_alive ? "" : "text-muted line-through decoration-accent"}`}>
            {p.name}
            {p.id === meId && <span className="ml-1 text-sm text-muted">(you)</span>}
          </span>
          {!p.is_alive && <Skull className="size-5 text-muted" aria-label="Dead" />}
          {p.revealed_role && <RoleBadge role={p.revealed_role} />}
        </li>
      ))}
    </ul>
  );
}
