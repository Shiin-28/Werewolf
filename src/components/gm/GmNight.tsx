"use client";

import { useState } from "react";
import { Check, ChevronRight, Eye, Ghost, Loader, RotateCcw, Shield, SkipForward, Sun } from "lucide-react";
import { rpc } from "@/lib/supabase";
import { nightSteps, playerName, roleOf, STEP_KIND, STEP_ROLE, tonight } from "@/lib/selectors";
import { ROLES } from "@/lib/roles";
import type { NightAction, NightStep, Snapshot } from "@/lib/types";
import { BottomBar, Button, Card, Notice } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { WolfPaw } from "@/components/icons/WolfPaw";
import { WolfChat } from "@/components/WolfChat";
import { PlayerTable } from "./PlayerTable";

type Step = Exclude<NightStep, "done">;

const SCRIPT: Record<Step, { name: string; wake: string; wakeJa: string; ask: string; intro: string; sleep: string; icon: React.ReactNode }> = {
  knight: {
    name: "Knight", wake: "Knight, wake up.", wakeJa: "騎士、目を覚ましてください。",
    ask: "Choose someone to protect tonight.", intro: "Show yourself to me.", sleep: "Knight, close your eyes.",
    icon: <Shield className="size-10" />,
  },
  fortune: {
    name: "Fortune Teller", wake: "Fortune Teller, wake up.", wakeJa: "占い師、目を覚ましてください。",
    ask: "Choose someone to read.", intro: "Show yourself to me.", sleep: "Fortune Teller, close your eyes.",
    icon: <Eye className="size-10" />,
  },
  shaman: {
    name: "Shaman", wake: "Shaman, wake up.", wakeJa: "霊媒師、目を覚ましてください。",
    ask: "Look at the spirit of the most recent dead.", intro: "Show yourself to me.", sleep: "Shaman, close your eyes.",
    icon: <Ghost className="size-10" />,
  },
  wolves: {
    name: "Werewolves", wake: "Werewolves, wake up.", wakeJa: "人狼、目を覚ましてください。",
    ask: "Choose your victim.", intro: "Look at each other. This is your pack.", sleep: "Werewolves, close your eyes.",
    icon: <WolfPaw className="size-12" />,
  },
};

/** What the GM sees for a step's result. `null` = still waiting. */
function describe(snap: Snapshot, step: Step, a: NightAction | undefined): string | null {
  if (snap.game.round === 1) return "Introductions only — no action";
  if (!a) return null;
  if (step === "wolves" && !a.locked) {
    return a.target_player_id ? `Considering ${playerName(snap, a.target_player_id)}…` : null;
  }
  if (!a.target_player_id) return step === "shaman" && a.actor_player_id ? "Shaman: no one has died yet" : "Skipped";
  const target = playerName(snap, a.target_player_id);
  const color = a.result === "black" ? "BLACK" : "WHITE";
  if (step === "knight") return `Knight protected: ${target}`;
  if (step === "fortune") return `Fortune Teller read: ${target} → ${color}`;
  if (step === "shaman") return `Shaman learned: ${target} → ${color}`;
  return `Wolves chose: ${target}`;
}

function isComplete(step: Step, a: NightAction | undefined, intro: boolean) {
  if (intro) return true;
  return !!a && (step !== "wolves" || a.locked);
}

export function GmNight({ snap }: { snap: Snapshot }) {
  const { game } = snap;
  const [confirm, dialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = nightSteps(snap);
  const current = game.night_step;

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

  const holders = (step: Step) => snap.players.filter((p) => roleOf(snap, p.id) === STEP_ROLE[step]);
  const roleAlive = (step: Step) => holders(step).some((p) => p.is_alive);

  async function advance(step: Step) {
    const a = tonight(snap, STEP_KIND[step]);
    if (roleAlive(step) && !isComplete(step, a, game.round === 1)) {
      const ok = await confirm({
        title: `Skip the ${SCRIPT[step].name}?`,
        message:
          step === "wolves" && a?.target_player_id
            ? "The wolves haven't locked in. Skipping means nobody is attacked tonight."
            : `The ${SCRIPT[step].name} hasn't chosen yet. Their turn will be skipped.`,
        confirmLabel: "Skip",
        danger: true,
      });
      if (!ok) return;
    }
    await run(() => rpc("advance_night_step", { p_game: game.id, p_from: step }));
  }

  async function resetWolves() {
    const ok = await confirm({
      title: "Reset the wolves' choice?",
      message: "Their pick is cleared and they can choose again.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) await run(() => rpc("reset_wolf_choice", { p_game: game.id }));
  }

  const idx = current && current !== "done" ? steps.indexOf(current) : steps.length;
  const nextLabel = (step: Step) => {
    const n = steps[steps.indexOf(step) + 1];
    return n ? SCRIPT[n].name : "Dawn";
  };

  return (
    <>
      {dialog}

      {/* Progress */}
      <ol className="flex items-center gap-1 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span
              className={`flex-1 rounded-sm border px-2 py-1.5 text-center font-display uppercase tracking-wider ${
                i < idx ? "border-line text-muted" : i === idx ? "border-accent bg-accent/20 text-fg" : "border-line text-muted/60"
              }`}
            >
              {i < idx && <Check className="mr-1 inline size-3" />}
              {SCRIPT[s].name}
            </span>
            <ChevronRight className="size-3 shrink-0 text-muted" aria-hidden />
          </li>
        ))}
        <li className={`rounded-sm border px-2 py-1.5 font-display uppercase tracking-wider ${current === "done" ? "border-accent bg-accent/20" : "border-line text-muted/60"}`}>
          Dawn
        </li>
      </ol>

      {game.round === 1 && current !== "done" && (
        <Notice>
          <b>Night 1 is for introductions.</b> Call each role awake so you can see who they are and the wolves
          can see each other. Nobody protects, inspects or attacks tonight.
        </Notice>
      )}

      {current && current !== "done" && (
        <StepCard
          snap={snap}
          step={current}
          busy={busy}
          onAdvance={() => advance(current)}
          onResetWolves={resetWolves}
          nextLabel={nextLabel(current)}
          holders={holders(current).map((p) => p.name)}
          alive={roleAlive(current)}
        />
      )}

      {current === "done" && (
        <Card className="text-center">
          <Sun className="mx-auto size-12 text-accent" aria-hidden />
          <p className="mt-2 font-display text-2xl uppercase tracking-[0.12em]">The night is over</p>
          <p className="text-muted">Everyone, close your eyes… then reveal the morning.</p>
        </Card>
      )}

      <Card title={`Night ${game.round} log`} ja="夜の記録">
        <ul className="flex flex-col gap-2 text-sm">
          {steps.map((s) => {
            const text = describe(snap, s, tonight(snap, STEP_KIND[s]));
            return (
              <li key={s} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-display uppercase tracking-wider text-muted">{SCRIPT[s].name}</span>
                <span className={text ? "" : "text-muted"}>{text ?? (s === current ? "Waiting…" : "—")}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}

      <PlayerTable snap={snap} />

      {current === "done" && (
        <BottomBar>
          <Button big disabled={busy} onClick={() => run(() => rpc("reveal_morning", { p_game: game.id }))}>
            <Sun className="size-6" /> Reveal morning
          </Button>
          <p className="mt-1 text-center text-sm text-muted">Everyone&apos;s screen shows who died (or that no one did)</p>
        </BottomBar>
      )}
    </>
  );
}

function StepCard({ snap, step, busy, onAdvance, onResetWolves, nextLabel, holders, alive }: {
  snap: Snapshot;
  step: Step;
  busy: boolean;
  onAdvance: () => void;
  onResetWolves: () => void;
  nextLabel: string;
  holders: string[];
  alive: boolean;
}) {
  const s = SCRIPT[step];
  const a = tonight(snap, STEP_KIND[step]);
  const intro = snap.game.round === 1;
  const complete = isComplete(step, a, intro);
  const result = describe(snap, step, a);
  const role = ROLES[STEP_ROLE[step]];

  return (
    <>
      <Card className="text-center">
        <div className="mx-auto w-fit text-accent">{s.icon}</div>
        <p className="mt-2 font-display text-3xl uppercase tracking-[0.1em]">{s.wake}</p>
        <p className="font-jp text-accent">{s.wakeJa}</p>
        <p className="mt-1 text-muted">“{intro ? s.intro : s.ask}”</p>

        <p className="mt-3 text-sm">
          <span className="text-muted">{role.name}: </span>
          <b>{holders.join(", ")}</b>
          {!alive && <span className="ml-1 text-accent">(dead — call it anyway)</span>}
        </p>

        <div
          className={`mt-4 flex min-h-14 items-center justify-center gap-2 rounded-md border px-3 py-2 ${
            complete ? "border-emerald-700 bg-emerald-700/15" : "border-line bg-bg/60"
          }`}
        >
          {complete ? (
            <Check className="size-5 text-emerald-500" aria-hidden />
          ) : alive ? (
            <Loader className="size-5 animate-spin text-muted" aria-hidden />
          ) : null}
          <span className="font-medium">
            {complete || result ? result : alive ? `Waiting for ${s.name}…` : `No living ${role.name} — pause, then skip`}
          </span>
        </div>

        {complete && <p className="mt-3 text-muted">Then say: “{s.sleep}”</p>}

        {step === "wolves" && a && !intro && (
          <Button variant="secondary" className="mt-3" disabled={busy} onClick={onResetWolves}>
            <RotateCcw className="size-4" /> Reset wolf choice
          </Button>
        )}
      </Card>

      {step === "wolves" && snap.game.role_counts.werewolf >= 2 && (
        <WolfChat snap={snap} canSend={false} note="GM view — read only." />
      )}

      <BottomBar>
        {complete || !alive ? (
          <Button big disabled={busy} onClick={onAdvance}>
            {complete ? <ChevronRight className="size-6" /> : <SkipForward className="size-6" />}
            {complete ? `Next: ${nextLabel}` : `Skip ${s.name}`}
          </Button>
        ) : (
          <Button big variant="secondary" disabled={busy} onClick={onAdvance}>
            <SkipForward className="size-6" /> Skip {s.name}
          </Button>
        )}
      </BottomBar>
    </>
  );
}
