"use client";

import { useState } from "react";
import { EyeOff, Hand } from "lucide-react";
import { ROLES, TEAMS } from "@/lib/roles";
import type { Player, RoleId } from "@/lib/types";
import { WolfPaw } from "@/components/icons/WolfPaw";

/**
 * Face-down card; tap to flip and see your role, tap again to hide.
 * Always starts hidden; after that only the player decides when it flips.
 */
export function RoleCard({ role, wolves, madmenInGame, onFirstReveal }: {
  role: RoleId;
  /** Fellow wolves (for a wolf) or the wolves (for the Madman). */
  wolves: Player[];
  madmenInGame: number;
  onFirstReveal?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [everRevealed, setEverRevealed] = useState(false);
  const info = ROLES[role];
  const team = TEAMS[info.team];
  const Icon = info.icon;

  function toggle() {
    if (!revealed && !everRevealed) {
      setEverRevealed(true);
      onFirstReveal?.();
    }
    setRevealed((r) => !r);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={revealed}
      aria-label={revealed ? "Hide your role" : "Reveal your role"}
      className="block w-full text-left perspective-[1400px]"
    >
      <div
        className={`grid transition-transform duration-500 transform-3d [&>*]:col-start-1 [&>*]:row-start-1 ${
          revealed ? "rotate-y-180" : ""
        }`}
      >
        {/* Back of the card */}
        <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 rounded-lg border border-accent/50 bg-[repeating-linear-gradient(45deg,#140a0c_0_10px,#0d0708_10px_20px)] p-6 text-center shadow-[0_0_40px_-14px_var(--glow)] backface-hidden">
          <WolfPaw className="size-24 animate-flicker text-accent" aria-hidden />
          <div>
            <p className="font-display text-2xl uppercase tracking-[0.2em]">Tap to reveal</p>
            <p className="font-jp text-accent">タップして役職を確認</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Hand className="size-4" aria-hidden /> Shield your screen from others
          </p>
        </div>

        {/* Front: the role */}
        <div className={`flex min-h-[26rem] rotate-y-180 flex-col gap-4 rounded-lg border border-black/50 p-6 shadow-[0_0_40px_-14px_var(--glow)] backface-hidden ${info.card}`}>
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-md border border-current/30 bg-black/25">
              <Icon className="size-10" aria-hidden />
            </span>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] opacity-80">You are the</p>
              <p className="font-display text-4xl uppercase leading-none tracking-[0.08em]">{info.name}</p>
              <p className="font-jp text-lg">{info.ja}</p>
            </div>
          </div>

          <p className="w-fit rounded-sm bg-black/30 px-2 py-1 text-sm uppercase tracking-wider">
            Team: {team.name} <span className="font-jp normal-case">{team.ja}</span>
          </p>
          <p className="leading-snug">{info.description}</p>
          <p className="border-l-2 border-current/50 pl-3 text-sm leading-snug">
            <span className="font-display uppercase tracking-wider">How to win · </span>
            {info.win}
          </p>

          {role === "werewolf" && (
            <div className="rounded-md bg-black/35 p-3 text-sm">
              <p className="font-display uppercase tracking-wider">Your pack</p>
              {wolves.length > 0 ? (
                <p className="text-base">{wolves.map((w) => w.name).join(", ")}</p>
              ) : (
                <p>You hunt alone.</p>
              )}
              {madmenInGame > 0 && (
                <p className="mt-1 opacity-80">
                  {madmenInGame === 1 ? "A Madman serves" : `${madmenInGame} Madmen serve`} you in secret — you
                  don&apos;t know who.
                </p>
              )}
            </div>
          )}
          {role === "madman" && (
            <div className="rounded-md bg-black/35 p-3 text-sm">
              <p className="font-display uppercase tracking-wider">The werewolves</p>
              <p className="text-base">{wolves.map((w) => w.name).join(", ") || "—"}</p>
              <p className="mt-1 opacity-80">They don&apos;t know you. Help them without getting caught.</p>
            </div>
          )}

          <p className="mt-auto flex items-center justify-center gap-2 text-sm opacity-80">
            <EyeOff className="size-4" aria-hidden /> Tap to hide
          </p>
        </div>
      </div>
    </button>
  );
}
