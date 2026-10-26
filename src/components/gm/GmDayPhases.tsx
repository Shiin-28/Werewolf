"use client";

import { Gavel, MessagesSquare, Moon, Plus, Square, Timer, Vote } from "lucide-react";
import { useRpc } from "@/hooks/useRpc";
import { useSecondsLeft } from "@/hooks/useServerClock";
import { playerName } from "@/lib/selectors";
import type { Snapshot } from "@/lib/types";
import { BottomBar, Button, Card, Notice } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { Countdown, formatClock } from "@/components/Countdown";
import { MorningAnnouncement, VoteResult } from "@/components/Announcements";
import { PlayerTable } from "./PlayerTable";
import { WinPanel } from "./WinPanel";
import { NightSummary } from "./GameLog";

// ---------------------------------------------------------------------------
export function GmMorning({ snap }: { snap: Snapshot }) {
  const { game } = snap;
  const { busy, error, run } = useRpc();

  return (
    <>
      <MorningAnnouncement snap={snap} />
      <Card title="What really happened" ja="GMのみ">
        <NightSummary snap={snap} round={game.round} />
      </Card>
      <PlayerTable snap={snap} />
      {error && <Notice tone="error">{error}</Notice>}
      {game.pending_winner ? (
        <WinPanel snap={snap} winner={game.pending_winner} />
      ) : (
        <BottomBar>
          <Button big disabled={busy} onClick={() => run("start_discussion", { p_game: game.id })}>
            <MessagesSquare className="size-6" /> Start Day {game.round} discussion
          </Button>
        </BottomBar>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
const PRESETS = [60, 120, 180, 300];

export function GmDay({ snap }: { snap: Snapshot }) {
  const { game } = snap;
  const { busy, error, run } = useRpc();
  const left = useSecondsLeft(game.timer_ends_at);
  const running = left !== null && left > 0;
  const startTimer = (s: number) => run("start_timer", { p_game: game.id, p_seconds: s });

  return (
    <>
      <Countdown endsAt={game.timer_ends_at} />
      <Card title="Discussion timer" ja="議論タイマー">
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((s) => (
            <Button key={s} variant={s === game.timer_seconds ? "primary" : "secondary"} disabled={busy} onClick={() => startTimer(s)}>
              {formatClock(s)}
            </Button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy || !running} onClick={() => left !== null && startTimer(left + 60)}>
            <Plus className="size-4" /> 1 min
          </Button>
          <Button variant="secondary" disabled={busy || game.timer_ends_at === null} onClick={() => run("stop_timer", { p_game: game.id })}>
            <Square className="size-4" /> Stop
          </Button>
        </div>
        {!game.timer_ends_at && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Timer className="size-4" /> Optional. Everyone sees the same countdown.
          </p>
        )}
      </Card>
      <MorningAnnouncement snap={snap} compact />
      <PlayerTable snap={snap} />
      {error && <Notice tone="error">{error}</Notice>}
      <BottomBar>
        <Button big disabled={busy} onClick={() => run("start_voting", { p_game: game.id })}>
          <Vote className="size-6" /> Start voting
        </Button>
      </BottomBar>
    </>
  );
}

// ---------------------------------------------------------------------------
export function GmVoting({ snap }: { snap: Snapshot }) {
  const { game } = snap;
  const { busy, error, run } = useRpc();
  const [confirm, dialog] = useConfirm();
  const living = snap.players.filter((p) => p.is_alive);
  const votes = snap.votes.filter((v) => v.round === game.round);
  const byVoter = new Map(votes.map((v) => [v.voter_player_id, v.target_player_id]));

  const tally = new Map<string, number>();
  for (const v of votes) {
    if (!living.some((p) => p.id === v.voter_player_id)) continue;
    const k = v.target_player_id ?? "skip";
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 0;
  const waiting = living.filter((p) => !byVoter.has(p.id));

  async function end() {
    if (waiting.length) {
      const ok = await confirm({
        title: "End voting now?",
        message: `${waiting.map((p) => p.name).join(", ")} ${waiting.length === 1 ? "hasn't" : "haven't"} voted yet.`,
        confirmLabel: "End voting",
        danger: true,
      });
      if (!ok) return;
    }
    await run("end_voting", { p_game: game.id });
  }

  return (
    <>
      {dialog}
      <Card className="text-center">
        <p className="font-display text-4xl tabular-nums">{votes.length}/{living.length}</p>
        <p className="text-sm text-muted">have voted · players only see this number</p>
      </Card>
      <Card title="Live tally" ja="集計">
        <ul className="flex flex-col gap-2">
          {rows.map(([k, n]) => (
            <li key={k} className="flex items-center gap-3">
              <span className={`w-28 shrink-0 truncate ${k === "skip" ? "italic text-muted" : "font-medium"}`}>
                {k === "skip" ? "Skip" : playerName(snap, k)}
              </span>
              <span className="h-6 flex-1 overflow-hidden rounded-sm bg-line/50">
                <span className={`block h-full ${n === max ? "bg-accent" : "bg-muted/60"}`} style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right font-display text-lg tabular-nums">{n}</span>
            </li>
          ))}
          {!rows.length && <li className="text-muted">No votes yet.</li>}
        </ul>
      </Card>
      <Card title="Who voted for whom" ja="投票先">
        <ul className="divide-y divide-line text-sm">
          {living.map((p) => (
            <li key={p.id} className="flex min-h-10 items-center gap-2">
              <span className="w-28 shrink-0 truncate font-medium">{p.name}</span>
              <span className="text-muted">→</span>
              <span className={byVoter.has(p.id) ? "" : "text-muted"}>
                {!byVoter.has(p.id) ? "not voted" : byVoter.get(p.id) ? playerName(snap, byVoter.get(p.id)) : "Skip"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {error && <Notice tone="error">{error}</Notice>}
      <BottomBar>
        <Button big disabled={busy} onClick={end}>
          <Gavel className="size-6" /> End voting
        </Button>
      </BottomBar>
    </>
  );
}

// ---------------------------------------------------------------------------
export function GmVoteResult({ snap }: { snap: Snapshot }) {
  const { game } = snap;
  const { busy, error, run } = useRpc();
  return (
    <>
      <VoteResult snap={snap} />
      <PlayerTable snap={snap} />
      {error && <Notice tone="error">{error}</Notice>}
      {game.pending_winner ? (
        <WinPanel snap={snap} winner={game.pending_winner} />
      ) : (
        <BottomBar>
          <Button big disabled={busy} onClick={() => run("begin_night", { p_game: game.id })}>
            <Moon className="size-6" /> Begin Night {game.round + 1}
          </Button>
        </BottomBar>
      )}
    </>
  );
}
