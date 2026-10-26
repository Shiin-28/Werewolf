"use client";

import { useEffect, useRef, useState } from "react";
import { Play, UserX } from "lucide-react";
import { rpc } from "@/lib/supabase";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { validateSetup } from "@/lib/validate";
import type { RoleCounts, Snapshot } from "@/lib/types";
import { BottomBar, Button, Card, Notice, Stepper, Toggle } from "@/components/ui";
import { PlayerList } from "@/components/PlayerList";
import { useConfirm } from "@/components/ConfirmDialog";
import { SharePanel } from "./SharePanel";

const SAVE_DEBOUNCE_MS = 400;
const TIMER_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
];

interface Draft {
  player_count: number;
  role_counts: RoleCounts;
  reveal_on_death: boolean;
  timer_seconds: number | null;
}

export function LobbySetup({ snap, broadcastRefresh }: { snap: Snapshot; broadcastRefresh: () => void }) {
  const { game, players } = snap;
  const [confirm, dialog] = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => ({
    player_count: game.player_count,
    role_counts: game.role_counts,
    reveal_on_death: game.reveal_on_death,
    timer_seconds: game.timer_seconds,
  }));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function update(next: Draft) {
    setDraft(next);
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await rpc("update_settings", {
          p_game: game.id,
          p_player_count: next.player_count,
          p_role_counts: next.role_counts,
          p_reveal_on_death: next.reveal_on_death,
          p_timer_seconds: next.timer_seconds,
        });
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // Changing the player count adds/removes Villagers so the totals usually stay in step.
  function setPlayerCount(n: number) {
    const delta = n - draft.player_count;
    const villager = Math.max(0, draft.role_counts.villager + delta);
    update({ ...draft, player_count: n, role_counts: { ...draft.role_counts, villager } });
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function kick(playerId: string, name: string) {
    const ok = await confirm({
      title: `Kick ${name}?`,
      message: "They'll be removed from the lobby. They can rejoin with the code.",
      confirmLabel: "Kick",
      danger: true,
    });
    if (ok) await run(async () => {
      await rpc("kick_player", { p_player: playerId });
      broadcastRefresh(); // deletes can't be filtered by realtime, so nudge every device
    });
  }

  async function startGame() {
    await run(() => rpc("start_game", { p_game: game.id }));
  }

  const v = validateSetup(draft.player_count, draft.role_counts);
  const joined = players.length;
  const emptySeats = draft.player_count - joined;
  const canStart = v.ok && emptySeats === 0 && !saving && !busy;
  const startHint = !v.ok
    ? "Fix the roles first"
    : emptySeats > 0
      ? `Waiting for ${emptySeats} more player${emptySeats === 1 ? "" : "s"}`
      : emptySeats < 0
        ? `${-emptySeats} too many players — kick or raise the count`
        : saving ? "Saving…" : "Everyone's here!";

  return (
    <>
      {dialog}
      {/* Desktop: invite + players on the left, setup pinned on the right (matches the in-game layout). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <SharePanel code={game.code} />

          <Card title={`Players ${joined}/${draft.player_count}`} ja="参加者">
            <PlayerList
              players={players}
              emptySeats={emptySeats}
              trailing={(p) => (
                <button
                  type="button"
                  onClick={() => kick(p.id, p.name)}
                  disabled={busy}
                  aria-label={`Kick ${p.name}`}
                  className="grid size-11 place-items-center rounded-md text-muted hover:bg-red-700/20 hover:text-accent"
                >
                  <UserX className="size-5" />
                </button>
              )}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto">
          <Card title="Setup" ja="設定">
            <Stepper
              label="Players"
              sub="人数"
              value={draft.player_count}
              min={3}
              max={20}
              onChange={setPlayerCount}
            />
            <div className="my-2 border-t border-line" />
            {ROLE_ORDER.map((r) => {
              const info = ROLES[r];
              const Icon = info.icon;
              return (
                <Stepper
                  key={r}
                  label={info.name}
                  sub={`${info.ja} · ${info.team === "village" ? "Village" : "Wolf side"}`}
                  value={draft.role_counts[r]}
                  max={info.max ?? 20}
                  onChange={(n) => update({ ...draft, role_counts: { ...draft.role_counts, [r]: n } })}
                  icon={
                    <span className={`grid size-10 shrink-0 place-items-center rounded-md border border-black/40 ${info.card}`}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                  }
                />
              );
            })}
            <div
              className={`mt-2 rounded-sm border-l-4 px-4 py-2 text-center font-display font-normal tracking-wider ${
                v.total === draft.player_count ? "border-emerald-700 bg-emerald-700/15" : "border-red-600 bg-red-700/20"
              }`}
            >
              Roles {v.total} / {draft.player_count} players
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {v.errors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}
              {v.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
            </div>

            <div className="my-3 border-t border-line" />
            <Toggle
              label="Reveal role when a player dies"
              sub="死亡時に役職を公開"
              checked={draft.reveal_on_death}
              onChange={(b) => update({ ...draft, reveal_on_death: b })}
            />
            <div className="py-2">
              <div className="font-semibold leading-tight">Discussion timer</div>
              <div className="text-sm text-muted">議論タイマー</div>
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {TIMER_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => update({ ...draft, timer_seconds: o.seconds })}
                    className={`min-h-11 rounded-md border font-display text-sm font-normal ${
                      draft.timer_seconds === o.seconds
                        ? "border-red-950 bg-accent text-accent-fg shadow-[0_0_16px_-4px_var(--glow)]"
                        : "border-line hover:border-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </div>

      <BottomBar>
        <Button big disabled={!canStart} onClick={startGame}>
          <Play className="size-6" /> Start game
        </Button>
        <p className="mt-1 text-center text-sm text-muted">{startHint}</p>
      </BottomBar>
    </>
  );
}
