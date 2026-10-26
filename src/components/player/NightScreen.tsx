"use client";

import { useState } from "react";
import { Eye, EyeClosed, Ghost, Lock, Shield } from "lucide-react";
import { rpc } from "@/lib/supabase";
import { knownWolves, playerName, roleOf, STEP_ROLE, tonight } from "@/lib/selectors";
import type { NightStep, Player, Snapshot } from "@/lib/types";
import { Button, Card, Notice } from "@/components/ui";
import { PlayerPicker } from "@/components/PlayerPicker";
import { WolfPaw } from "@/components/icons/WolfPaw";
import { WolfChat } from "@/components/WolfChat";
import { MyRolePanel } from "./MyRolePanel";

export function NightScreen({ snap, me }: { snap: Snapshot; me: Player }) {
  const step = snap.game.night_step;
  const role = roleOf(snap, me.id);
  const myTurn = me.is_alive && !!step && step !== "done" && STEP_ROLE[step] === role;

  const intro = snap.game.round === 1;
  const livingPack = role === "werewolf" ? 1 + knownWolves(snap, me).filter((w) => w.is_alive).length : 0;

  return (
    <>
      {!myTurn && <SleepScreen />}
      {myTurn && intro && <IntroTurn snap={snap} me={me} step={step} />}
      {myTurn && !intro && step === "knight" && <KnightTurn snap={snap} me={me} />}
      {myTurn && !intro && step === "fortune" && <FortuneTurn snap={snap} me={me} />}
      {myTurn && !intro && step === "shaman" && <ShamanTurn snap={snap} />}
      {myTurn && !intro && step === "wolves" && <WolvesTurn snap={snap} me={me} />}
      {/* The pack chat only exists when there is a pack: 2+ living wolves. */}
      {myTurn && step === "wolves" && livingPack >= 2 && <WolfChat snap={snap} meId={me.id} canSend />}
      <MyRolePanel snap={snap} me={me} />
    </>
  );
}

/** Night 1: wake up so the GM sees you (and wolves see each other). No action. */
function IntroTurn({ snap, me, step }: { snap: Snapshot; me: Player; step: Exclude<NightStep, "done"> }) {
  const pack = knownWolves(snap, me).filter((w) => w.is_alive);
  const content = {
    knight: {
      icon: <Shield className="size-12" />, title: "Knight, wake up", ja: "騎士、目を覚ましてください",
      body: "Show yourself to the GM with a small nod.", none: "No protection tonight.",
    },
    fortune: {
      icon: <Eye className="size-12" />, title: "Fortune Teller, wake up", ja: "占い師、目を覚ましてください",
      body: "Show yourself to the GM with a small nod.", none: "No fortune tonight.",
    },
    shaman: {
      icon: <Ghost className="size-12" />, title: "Shaman, wake up", ja: "霊媒師、目を覚ましてください",
      body: "Show yourself to the GM with a small nod.", none: "No spirits to read yet.",
    },
    wolves: {
      icon: <WolfPaw className="size-14" />, title: "Werewolves, wake up", ja: "人狼、目を覚ましてください",
      body: "Look around and recognise your pack.", none: "No attack tonight.",
    },
  }[step];

  return (
    <Card className="text-center">
      <TurnHeader icon={content.icon} title={content.title} ja={content.ja} prompt={content.body} />
      {step === "wolves" && (
        <div className="mx-auto mb-4 max-w-xs rounded-md border border-accent/50 bg-accent/10 p-3">
          <p className="font-display text-sm uppercase tracking-wider text-muted">Your pack</p>
          <p className="text-2xl font-medium">{pack.length ? pack.map((w) => w.name).join(", ") : "You hunt alone"}</p>
        </div>
      )}
      <p className="font-display uppercase tracking-wider">{content.none}</p>
      <p className="text-sm text-muted">The first night is for introductions. Close your eyes when the GM says so.</p>
    </Card>
  );
}

/** Identical for everyone who isn't acting, so a glance at a phone gives nothing away. */
function SleepScreen() {
  return (
    <Card className="py-10 text-center">
      <EyeClosed className="mx-auto size-16 animate-flicker text-accent" aria-hidden />
      <p className="mt-4 font-display text-3xl uppercase tracking-[0.15em]">Close your eyes</p>
      <p className="font-jp text-accent">目を閉じてください</p>
      <p className="mt-3 text-sm text-muted">Night has fallen. Wait for the GM.</p>
    </Card>
  );
}

function useAction(gameId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(target: string, lock = true) {
    setBusy(true);
    setError(null);
    try {
      return await rpc<string | null>("night_action", { p_game: gameId, p_target: target, p_lock: lock });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, send };
}

function TurnHeader({ icon, title, ja, prompt }: { icon: React.ReactNode; title: string; ja: string; prompt: string }) {
  return (
    <div className="mb-4 text-center">
      <div className="mx-auto mb-2 w-fit text-accent">{icon}</div>
      <p className="font-display text-2xl uppercase tracking-[0.12em]">{title}</p>
      <p className="font-jp text-sm text-accent">{ja}</p>
      <p className="mt-2 text-muted">{prompt}</p>
    </div>
  );
}

function KnightTurn({ snap, me }: { snap: Snapshot; me: Player }) {
  const done = tonight(snap, "protect");
  const [pick, setPick] = useState<string | null>(null);
  const { busy, error, send } = useAction(snap.game.id);
  const living = snap.players.filter((p) => p.is_alive);

  if (done?.target_player_id)
    return (
      <Card className="py-8 text-center">
        <Shield className="mx-auto size-14 text-accent" aria-hidden />
        <p className="mt-3 text-muted">Tonight you protect</p>
        <p className="font-display text-4xl uppercase tracking-[0.08em]">{playerName(snap, done.target_player_id)}</p>
        <p className="mt-4 font-display uppercase tracking-wider">Now close your eyes</p>
      </Card>
    );

  return (
    <Card>
      <TurnHeader icon={<Shield className="size-12" />} title="Knight, wake up" ja="騎士、目を覚ましてください" prompt="Choose one player to protect tonight. You may choose yourself." />
      <PlayerPicker players={living} selectedId={pick} onSelect={setPick} meId={me.id} disabled={busy} />
      <Button big className="mt-4" disabled={!pick || busy} onClick={() => pick && send(pick)}>
        <Shield className="size-6" /> Protect {pick ? playerName(snap, pick) : ""}
      </Button>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}

function FortuneTurn({ snap, me }: { snap: Snapshot; me: Player }) {
  const done = tonight(snap, "inspect");
  const [pick, setPick] = useState<string | null>(null);
  const { busy, error, send } = useAction(snap.game.id);
  const others = snap.players.filter((p) => p.is_alive && p.id !== me.id);

  if (done?.target_player_id && done.result)
    return <ColorResult intro="Your vision reveals" name={playerName(snap, done.target_player_id)} result={done.result} />;

  return (
    <Card>
      <TurnHeader icon={<Eye className="size-12" />} title="Fortune Teller, wake up" ja="占い師、目を覚ましてください" prompt="Choose one player. You'll see WHITE (village) or BLACK (werewolf)." />
      <PlayerPicker players={others} selectedId={pick} onSelect={setPick} disabled={busy} />
      <Button big className="mt-4" disabled={!pick || busy} onClick={() => pick && send(pick)}>
        <Eye className="size-6" /> Read {pick ? playerName(snap, pick) : ""}
      </Button>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}

/** The Shaman doesn't choose: the server reads the most recent death when this step begins. */
function ShamanTurn({ snap }: { snap: Snapshot }) {
  const reading = tonight(snap, "medium");
  if (!reading)
    return (
      <Card className="text-center">
        <TurnHeader icon={<Ghost className="size-12" />} title="Shaman, wake up" ja="霊媒師、目を覚ましてください" prompt="Listening to the spirits…" />
      </Card>
    );
  if (!reading.target_player_id || !reading.result)
    return (
      <Card className="py-8 text-center">
        <Ghost className="mx-auto size-14 text-accent" aria-hidden />
        <p className="mt-3 font-display text-2xl uppercase tracking-[0.1em]">The spirits are silent</p>
        <p className="text-muted">No one has died yet.</p>
        <p className="mt-4 font-display uppercase tracking-wider">Now close your eyes</p>
      </Card>
    );
  return (
    <ColorResult
      intro="The spirit of the most recent dead"
      name={playerName(snap, reading.target_player_id)}
      result={reading.result}
    />
  );
}

/** Big WHITE 白 / BLACK 黒 card used by the Fortune Teller and the Shaman. */
function ColorResult({ intro, name, result }: { intro: string; name: string; result: "white" | "black" }) {
  const black = result === "black";
  return (
    <Card className="text-center">
      <p className="text-muted">{intro}</p>
      <p className="font-display text-3xl uppercase tracking-[0.08em]">{name}</p>
      <div
        className={`mx-auto my-4 grid h-44 w-full max-w-xs place-items-center rounded-lg ${
          black
            ? "bg-black text-red-500 ring-2 ring-red-700 shadow-[0_0_48px_-8px_var(--glow)]"
            : "bg-[#f3ece6] text-black shadow-[0_0_48px_-8px_rgb(255_255_255/0.4)]"
        }`}
      >
        <div>
          <p className="font-display text-6xl uppercase tracking-[0.15em]">{black ? "Black" : "White"}</p>
          <p className="font-jp text-2xl">{black ? "黒" : "白"}</p>
        </div>
      </div>
      <p className="font-semibold">{black ? "A Werewolf." : "Not a Werewolf."}</p>
      <p className="mt-4 font-display uppercase tracking-wider">Now close your eyes</p>
    </Card>
  );
}

function WolvesTurn({ snap, me }: { snap: Snapshot; me: Player }) {
  const kill = tonight(snap, "kill");
  const { busy, error, send } = useAction(snap.game.id);
  const pack = [me, ...knownWolves(snap, me).filter((w) => w.is_alive)];
  const packIds = new Set(pack.map((w) => w.id));
  const prey = snap.players.filter((p) => p.is_alive && !packIds.has(p.id));

  if (kill?.locked && kill.target_player_id)
    return (
      <Card className="py-8 text-center">
        <WolfPaw className="mx-auto size-16 text-accent" aria-hidden />
        <p className="mt-3 text-muted">The pack has chosen</p>
        <p className="font-display text-4xl uppercase tracking-[0.08em] text-accent">{playerName(snap, kill.target_player_id)}</p>
        <p className="mt-4 font-display uppercase tracking-wider">Now close your eyes</p>
      </Card>
    );

  const proposed = kill?.target_player_id ?? null;
  return (
    <Card>
      <TurnHeader
        icon={<WolfPaw className="size-14" />}
        title="Werewolves, wake up"
        ja="人狼、目を覚ましてください"
        prompt="Agree on one victim. Every wolf sees the choice live — any wolf can lock it in."
      />
      <p className="mb-3 text-center text-sm">
        Pack: <b>{pack.map((w) => (w.id === me.id ? "you" : w.name)).join(", ")}</b>
      </p>
      <PlayerPicker
        players={prey}
        selectedId={proposed}
        onSelect={(id) => send(id, false)}
        note={(p) => (p.id === proposed && kill?.actor_player_id ? `${kill.actor_player_id === me.id ? "Your" : playerName(snap, kill.actor_player_id) + "'s"} pick` : null)}
        disabled={busy}
      />
      <Button big className="mt-4" disabled={!proposed || busy} onClick={() => proposed && send(proposed, true)}>
        <Lock className="size-6" /> Lock in {proposed ? playerName(snap, proposed) : ""}
      </Button>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}
