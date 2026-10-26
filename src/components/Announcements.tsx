import { Moon, Scale, Skull } from "lucide-react";
import { playerName } from "@/lib/selectors";
import type { Snapshot } from "@/lib/types";
import { Card } from "@/components/ui";
import { RoleBadge } from "./RoleBadge";

function eventFor(snap: Snapshot, kind: "morning" | "vote", round = snap.game.round) {
  return snap.events.find((e) => e.kind === kind && e.round === round);
}

/** "Ana was killed last night" / "No one died last night." Public — identical on every screen. */
export function MorningAnnouncement({ snap, compact = false }: { snap: Snapshot; compact?: boolean }) {
  const ev = eventFor(snap, "morning");
  if (!ev) return null;
  const victim = snap.players.find((p) => p.id === ev.victim_player_id);

  return (
    <Card className={`text-center ${compact ? "" : "py-8"}`}>
      {victim ? (
        <Skull className={`mx-auto text-accent ${compact ? "size-8" : "size-14"}`} aria-hidden />
      ) : (
        <Moon className={`mx-auto text-muted ${compact ? "size-8" : "size-14"}`} aria-hidden />
      )}
      {!compact && <p className="mt-3 text-sm uppercase tracking-[0.2em] text-muted">Last night…</p>}
      <p className={`font-display uppercase tracking-[0.08em] ${compact ? "text-xl" : "text-3xl"}`}>
        {victim ? (
          <>
            <span className="text-accent">{victim.name}</span> was killed
          </>
        ) : (
          "No one died"
        )}
      </p>
      <p className="font-jp text-sm text-accent">
        {victim ? `${victim.name}が襲撃されました` : "犠牲者はいませんでした"}
      </p>
      {victim?.revealed_role && (
        <div className="mt-3 flex justify-center">
          <RoleBadge role={victim.revealed_role} />
        </div>
      )}
    </Card>
  );
}

/** Vote outcome + counts per player. Shown on every screen. */
export function VoteResult({ snap }: { snap: Snapshot }) {
  const ev = eventFor(snap, "vote");
  if (!ev) return null;
  const victim = snap.players.find((p) => p.id === ev.victim_player_id);
  const rows = Object.entries(ev.tally ?? {})
    .map(([k, n]) => ({ k, n, name: k === "skip" ? "Skip" : playerName(snap, k) }))
    .sort((a, b) => b.n - a.n);
  const max = rows[0]?.n ?? 0;
  const reason = !rows.length
    ? "No votes were cast."
    : rows.filter((r) => r.n === max).length > 1
      ? "It's a tie."
      : rows[0].k === "skip"
        ? "Most players voted to skip."
        : null;

  return (
    <>
      <Card className="py-8 text-center">
        <Scale className="mx-auto size-14 text-accent" aria-hidden />
        <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em]">
          {victim ? (
            <>
              <span className="text-accent">{victim.name}</span> was eliminated
            </>
          ) : (
            "No one was eliminated"
          )}
        </p>
        <p className="font-jp text-sm text-accent">{victim ? `${victim.name}が処刑されました` : "処刑なし"}</p>
        {reason && <p className="mt-1 text-muted">{reason}</p>}
        {victim?.revealed_role && (
          <div className="mt-3 flex justify-center">
            <RoleBadge role={victim.revealed_role} />
          </div>
        )}
      </Card>
      <Card title="Votes" ja="投票数">
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.k} className="flex items-center gap-3">
              <span className={`w-28 shrink-0 truncate ${r.k === "skip" ? "italic text-muted" : "font-medium"}`}>{r.name}</span>
              <span className="h-6 flex-1 overflow-hidden rounded-sm bg-line/50">
                <span
                  className={`block h-full ${r.k === victim?.id ? "bg-accent" : "bg-muted/60"}`}
                  style={{ width: `${max ? (r.n / max) * 100 : 0}%` }}
                />
              </span>
              <span className="w-6 text-right font-display text-lg tabular-nums">{r.n}</span>
            </li>
          ))}
          {!rows.length && <li className="text-muted">No votes.</li>}
        </ul>
      </Card>
    </>
  );
}
