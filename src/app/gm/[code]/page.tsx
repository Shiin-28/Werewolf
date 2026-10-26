"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play } from "lucide-react";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import { useGameSnapshot } from "@/hooks/useGameSnapshot";
import { bannerFor } from "@/lib/phase";
import { rpc } from "@/lib/supabase";
import type { Snapshot } from "@/lib/types";
import { PhaseBanner } from "@/components/PhaseBanner";
import { BottomBar, Button, Card, FullScreenMessage, Notice, WideLayout } from "@/components/ui";
import { LobbySetup } from "@/components/gm/LobbySetup";
import { GmRoleReveal } from "@/components/gm/GmRoleReveal";
import { GmNight } from "@/components/gm/GmNight";
import { GmGameOver } from "@/components/gm/GmGameOver";
import { GmDay, GmMorning, GmVoteResult, GmVoting } from "@/components/gm/GmDayPhases";
import { GmMenu } from "@/components/gm/GmMenu";
import { PlayerTable } from "@/components/gm/PlayerTable";
import { GameLog } from "@/components/gm/GameLog";
import { GmContext } from "@/components/gm/GmContext";

export default function GmPage() {
  const code = (useParams<{ code: string }>().code ?? "").toUpperCase();
  const { userId, error: authError } = useAnonAuth();
  const { snap, status, error, refresh, broadcastRefresh } = useGameSnapshot(code, userId);
  const [menuError, setMenuError] = useState<string | null>(null);

  if (authError) return <FullScreenMessage title="Couldn't connect">{authError}</FullScreenMessage>;
  if (status === "loading") return <FullScreenMessage title="Connecting…" />;
  if (status === "error")
    return (
      <FullScreenMessage title="Something went wrong">
        <p className="text-muted">{error}</p>
        <button type="button" onClick={refresh} className="text-accent underline">Try again</button>
      </FullScreenMessage>
    );
  if (!snap || snap.game.gm_user_id !== userId)
    return (
      <FullScreenMessage title="Not your game">
        <p className="text-muted">Only the device that created this game can run it.</p>
        <Link href={`/join/${code}`} className="text-accent underline">Join as a player instead</Link>
      </FullScreenMessage>
    );

  const { game, players } = snap;
  const detail = game.phase === "lobby" ? `${players.length}/${game.player_count} joined` : "Game Master";
  // Desktop uses two columns: in a game, controls + a pinned game log; in the lobby, LobbySetup
  // splits itself into invite/players + setup. Header and bottom bar align to the left column.
  const showLog = game.phase !== "lobby";

  return (
    <WideLayout.Provider value>
      <GmContext.Provider value={{ broadcastRefresh }}>
        <PhaseBanner
          banner={bannerFor(game)}
          detail={detail}
          paused={game.paused}
          right={
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-accent/60 px-2 py-1 font-mono text-sm font-bold tracking-widest text-accent">
                {game.code}
              </span>
              <GmMenu game={game} onError={setMenuError} />
            </div>
          }
        />
        <div
          className={`mx-auto px-4 py-5 pb-36 ${
            showLog ? "max-w-xl lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6" : "max-w-xl lg:max-w-6xl"
          }`}
        >
          <main className="flex min-w-0 flex-col gap-4">
            {error && <Notice tone="error">{error}</Notice>}
            {menuError && <Notice tone="error">{menuError}</Notice>}
            {game.paused ? (
              <GmPaused snap={snap} onError={setMenuError} />
            ) : (
              <>
                {game.phase === "lobby" && <LobbySetup snap={snap} broadcastRefresh={broadcastRefresh} />}
                {game.phase === "role_reveal" && <GmRoleReveal snap={snap} />}
                {game.phase === "night" && <GmNight snap={snap} />}
                {game.phase === "morning" && <GmMorning snap={snap} />}
                {game.phase === "day" && <GmDay snap={snap} />}
                {game.phase === "voting" && <GmVoting snap={snap} />}
                {game.phase === "vote_result" && <GmVoteResult snap={snap} />}
                {game.phase === "game_over" && <GmGameOver snap={snap} />}
              </>
            )}
            {showLog && (
              <div className="lg:hidden">
                <GameLog snap={snap} />
              </div>
            )}
          </main>
          {showLog && (
            <aside className="sticky top-24 hidden max-h-[calc(100dvh-14rem)] overflow-y-auto rounded-lg border border-line bg-card/60 p-4 lg:block">
              <GameLog snap={snap} pinned />
            </aside>
          )}
        </div>
      </GmContext.Provider>
    </WideLayout.Provider>
  );
}

/** While paused the phase controls are hidden; the GM can only resume (or use the ⋮ menu). */
function GmPaused({ snap, onError }: { snap: Snapshot; onError: (m: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  async function resume() {
    setBusy(true);
    onError(null);
    try {
      await rpc("set_paused", { p_game: snap.game.id, p_paused: false });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card className="text-center">
        <p className="font-display text-2xl uppercase tracking-[0.12em]">Game paused</p>
        <p className="text-sm text-muted">Players can&apos;t act until you resume.</p>
      </Card>
      <PlayerTable snap={snap} />
      <BottomBar>
        <Button big disabled={busy} onClick={resume}>
          <Play className="size-6" /> Resume game
        </Button>
      </BottomBar>
    </>
  );
}
