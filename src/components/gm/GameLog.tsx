"use client";

import { useState } from "react";
import { ChevronDown, ScrollText, ShieldCheck } from "lucide-react";
import { playerName } from "@/lib/selectors";
import type { NightAction, Snapshot } from "@/lib/types";
import { Card } from "@/components/ui";

const color = (r: NightAction["result"]) => (r === "black" ? "BLACK" : "WHITE");

/** GM-only account of one night: every secret choice and what came of it. */
export function NightSummary({ snap, round }: { snap: Snapshot; round: number }) {
  const c = snap.game.role_counts;
  const act = (kind: NightAction["kind"]) => snap.nightActions.find((a) => a.round === round && a.kind === kind);
  const name = (id: string | null | undefined) => (id ? playerName(snap, id) : "—");
  const morning = snap.events.find((e) => e.kind === "morning" && e.round === round);
  const protect = act("protect"), inspect = act("inspect"), medium = act("medium"), kill = act("kill");
  const saved = morning && !morning.victim_player_id && kill?.target_player_id && kill.target_player_id === protect?.target_player_id;

  if (round === 1) return <p className="text-sm text-muted">Introductions only — nobody acted.</p>;

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {c.knight > 0 && <li>Knight protected: <b>{name(protect?.target_player_id)}</b></li>}
      {c.fortune_teller > 0 && (
        <li>
          Fortune Teller read: <b>{name(inspect?.target_player_id)}</b>
          {inspect?.result && ` → ${color(inspect.result)}`}
        </li>
      )}
      {c.shaman > 0 && (
        <li>
          Shaman learned:{" "}
          {medium?.target_player_id ? (
            <><b>{name(medium.target_player_id)}</b> → {color(medium.result)}</>
          ) : medium?.actor_player_id ? (
            "no one had died"
          ) : (
            "—"
          )}
        </li>
      )}
      <li>Wolves chose: <b>{name(kill?.target_player_id)}</b></li>
      {morning && (
        <li className="mt-1">
          Outcome:{" "}
          {morning.victim_player_id ? (
            <b className="text-accent">{name(morning.victim_player_id)} was killed</b>
          ) : (
            "no one died"
          )}
          {saved && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
              <ShieldCheck className="size-4" /> saved by Knight
            </span>
          )}
        </li>
      )}
    </ul>
  );
}

/**
 * History of every night, vote and GM correction so far.
 * Collapsible on phones; `pinned` renders it always open (desktop sidebar).
 */
export function GameLog({ snap, pinned = false }: { snap: Snapshot; pinned?: boolean }) {
  const [toggled, setToggled] = useState(false);
  const open = pinned || toggled;
  const rounds = Array.from({ length: snap.game.round }, (_, i) => snap.game.round - i);

  return (
    <div>
      {pinned ? (
        <h2 className="flex items-center gap-2 border-b border-line pb-2 text-muted">
          <ScrollText className="size-5 text-accent" aria-hidden />
          <span className="flex-1 font-display uppercase tracking-wider text-fg">Game log</span>
          <span className="font-jp text-sm text-accent">記録</span>
        </h2>
      ) : (
        <button
          type="button"
          onClick={() => setToggled((o) => !o)}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-2 rounded-md border border-line px-4 text-muted hover:border-accent hover:text-accent"
        >
          <ScrollText className="size-5" aria-hidden />
          <span className="flex-1 text-left font-display uppercase tracking-wider">Game log</span>
          <span className="font-jp text-sm">記録</span>
          <ChevronDown className={`size-5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
      {open && !rounds.length && <p className="mt-3 text-sm text-muted">Nothing has happened yet.</p>}
      {open && rounds.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {rounds.map((r) => {
            const vote = snap.events.find((e) => e.kind === "vote" && e.round === r);
            const manual = snap.events.filter((e) => e.kind === "manual" && e.round === r);
            const chat = snap.wolfMessages.filter((m) => m.round === r);
            return (
              <Card key={r}>
                <p className="mb-2 font-display uppercase tracking-wider text-accent">Night {r}</p>
                <NightSummary snap={snap} round={r} />
                {chat.length > 0 && (
                  <ul className="mt-2 border-l-2 border-accent/50 pl-2 text-xs">
                    {chat.map((m) => (
                      <li key={m.id}>
                        <b className="text-accent">{playerName(snap, m.sender_player_id)}:</b> {m.body}
                      </li>
                    ))}
                  </ul>
                )}
                {vote && (
                  <>
                    <p className="mb-1 mt-3 font-display uppercase tracking-wider text-accent">Day {r} vote</p>
                    <p className="text-sm">
                      {vote.victim_player_id ? (
                        <b>{playerName(snap, vote.victim_player_id)} was eliminated</b>
                      ) : (
                        "No one was eliminated"
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {Object.entries(vote.tally ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, n]) => `${k === "skip" ? "Skip" : playerName(snap, k)} ${n}`)
                        .join(" · ") || "No votes"}
                    </p>
                  </>
                )}
                {manual.length > 0 && (
                  <ul className="mt-3 text-xs text-muted">
                    {manual.map((m) => (
                      <li key={m.id}>
                        GM {m.tally?.kicked ? "kicked" : m.tally?.alive ? "revived" : "eliminated"}{" "}
                        {playerName(snap, m.victim_player_id)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
