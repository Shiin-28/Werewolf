"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Vote } from "lucide-react";
import { rpc } from "@/lib/supabase";
import { playerName } from "@/lib/selectors";
import type { Player, Snapshot } from "@/lib/types";
import { Button, Card, Notice } from "@/components/ui";
import { PlayerPicker } from "@/components/PlayerPicker";
import { MyRolePanel } from "./MyRolePanel";

const SKIP = "skip";

export function VoteScreen({ snap, me }: { snap: Snapshot; me: Player }) {
  const { game } = snap;
  const living = snap.players.filter((p) => p.is_alive);
  const myVote = snap.votes.find((v) => v.round === game.round && v.voter_player_id === me.id);
  const current = myVote ? (myVote.target_player_id ?? SKIP) : null;
  const [pick, setPick] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPick(current), [current]);

  async function submit() {
    if (!pick) return;
    setBusy(true);
    setError(null);
    try {
      await rpc("cast_vote", { p_game: game.id, p_target: pick === SKIP ? null : pick });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const progress = (
    <p className="text-center font-display text-lg uppercase tracking-wider">
      {game.votes_cast}/{living.length} voted
    </p>
  );

  if (!me.is_alive) return progress;

  const changed = pick !== current;
  const label = (id: string | null) => (id === SKIP ? "Skip" : playerName(snap, id));

  return (
    <>
      <Card>
        <div className="mb-4 text-center">
          <Vote className="mx-auto size-12 text-accent" aria-hidden />
          <p className="mt-2 font-display text-2xl uppercase tracking-[0.12em]">Vote</p>
          <p className="font-jp text-sm text-accent">投票してください</p>
          <p className="mt-1 text-muted">Who should be eliminated? You can change your vote until voting ends.</p>
        </div>
        <PlayerPicker
          players={living.filter((p) => p.id !== me.id)}
          selectedId={pick === SKIP ? null : pick}
          onSelect={setPick}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => setPick(SKIP)}
          aria-pressed={pick === SKIP}
          disabled={busy}
          className={`mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-md border italic transition ${
            pick === SKIP ? "border-accent bg-accent/20" : "border-dashed border-line text-muted hover:border-accent/60"
          }`}
        >
          <Ban className="size-5" aria-hidden /> Skip — vote for no one
        </button>
        <Button big className="mt-4" disabled={!pick || busy || !changed} onClick={submit}>
          {current && !changed ? <Check className="size-6" /> : <Vote className="size-6" />}
          {current && !changed ? `Voted: ${label(current)}` : pick ? `Vote ${label(pick)}` : "Choose someone"}
        </Button>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      </Card>
      {progress}
      <MyRolePanel snap={snap} me={me} />
    </>
  );
}
