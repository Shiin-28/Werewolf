"use client";

import { useState } from "react";
import { ChevronDown, IdCard } from "lucide-react";
import { knownWolves, playerName, roleOf } from "@/lib/selectors";
import type { Player, Snapshot } from "@/lib/types";
import { RoleCard } from "./RoleCard";

/** Collapsed "check my role" panel for later phases, plus the player's private night history. */
export function MyRolePanel({ snap, me }: { snap: Snapshot; me: Player }) {
  const [open, setOpen] = useState(false);
  const role = roleOf(snap, me.id);
  if (!role) return null;

  const history = snap.nightActions
    .filter((a) => a.actor_player_id === me.id && a.kind !== "kill" && a.target_player_id)
    .sort((a, b) => a.round - b.round);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 rounded-md border border-line px-4 text-muted hover:border-accent hover:text-accent"
      >
        <IdCard className="size-5" aria-hidden />
        <span className="flex-1 text-left font-display uppercase tracking-wider">My role & notes</span>
        <ChevronDown className={`size-5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <RoleCard role={role} wolves={knownWolves(snap, me)} madmenInGame={snap.game.role_counts.madman} />
          {history.length > 0 && (
            <ul className="rounded-md border border-line bg-card/60 p-3 text-sm">
              {history.map((a) => (
                <li key={`${a.round}-${a.kind}`} className="py-1">
                  <span className="text-muted">Night {a.round} · </span>
                  {a.kind === "protect" ? "Protected " : a.kind === "inspect" ? "Read " : "Spirit of "}
                  <b>{playerName(snap, a.target_player_id)}</b>
                  {a.result && (
                    <span className={`ml-2 rounded-sm px-1.5 py-0.5 font-display text-xs uppercase ${a.result === "black" ? "bg-black text-red-400 ring-1 ring-red-700" : "bg-[#f3ece6] text-black"}`}>
                      {a.result}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
