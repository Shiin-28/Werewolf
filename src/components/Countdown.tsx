"use client";

import { Timer } from "lucide-react";
import { useSecondsLeft } from "@/hooks/useServerClock";

export function formatClock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Discussion countdown, identical on every screen. Renders nothing when no timer is running. */
export function Countdown({ endsAt }: { endsAt: string | null }) {
  const left = useSecondsLeft(endsAt);
  if (left === null) return null;
  const urgent = left <= 10;
  return (
    <div
      role="timer"
      className={`flex items-center justify-center gap-3 rounded-lg border px-4 py-3 ${
        urgent ? "border-accent bg-accent/15 text-accent" : "border-line bg-card/80"
      }`}
    >
      <Timer className={`size-7 ${urgent && left > 0 ? "animate-pulse" : ""}`} aria-hidden />
      <span className="font-display text-5xl tabular-nums tracking-wider">{formatClock(left)}</span>
      {left === 0 && <span className="font-display text-lg uppercase tracking-wider">Time&apos;s up</span>}
    </div>
  );
}
