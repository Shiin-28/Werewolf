"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import { useGameSnapshot } from "@/hooks/useGameSnapshot";
import { bannerFor } from "@/lib/phase";
import { PhaseBanner } from "@/components/PhaseBanner";
import { FullScreenMessage, Notice } from "@/components/ui";
import { WaitingRoom } from "@/components/player/WaitingRoom";
import { RoleRevealScreen } from "@/components/player/RoleRevealScreen";
import { NightScreen } from "@/components/player/NightScreen";
import { DeadScreen } from "@/components/player/DeadScreen";
import { PausedScreen } from "@/components/player/PausedScreen";
import { GameOverScreen } from "@/components/GameOverScreen";
import { MorningAnnouncement, VoteResult } from "@/components/Announcements";
import { DayScreen } from "@/components/player/DayScreen";
import { VoteScreen } from "@/components/player/VoteScreen";
import { WolfChat } from "@/components/WolfChat";

export default function PlayPage() {
  const router = useRouter();
  const code = (useParams<{ code: string }>().code ?? "").toUpperCase();
  const { userId, error: authError } = useAnonAuth();
  const { snap, status, error, refresh } = useGameSnapshot(code, userId);

  const isGm = !!snap && snap.game.gm_user_id === userId;
  useEffect(() => {
    if (isGm) router.replace(`/gm/${code}`);
  }, [isGm, code, router]);

  if (authError) return <FullScreenMessage title="Couldn't connect">{authError}</FullScreenMessage>;
  if (status === "loading" || isGm) return <FullScreenMessage title="Connecting…" />;
  if (status === "error")
    return (
      <FullScreenMessage title="Something went wrong">
        <p className="text-muted">{error}</p>
        <button type="button" onClick={refresh} className="text-accent underline">Try again</button>
      </FullScreenMessage>
    );
  if (status === "not_found" || !snap)
    return (
      <FullScreenMessage title="You're not in this game">
        <p className="text-muted">The code may be wrong, or the GM removed you.</p>
        <Link href={`/join/${code}`} className="text-accent underline">Join game {code}</Link>
      </FullScreenMessage>
    );

  const { game, players } = snap;
  const me = players.find((p) => p.user_id === userId) ?? null;
  const banner = bannerFor(game);
  const detail = game.phase === "lobby" ? `${players.length}/${game.player_count} joined` : me?.name;

  return (
    <>
      <PhaseBanner banner={banner} detail={detail} paused={game.paused} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5 pb-24">
        {error && <Notice tone="error">{error}</Notice>}
        {game.phase === "game_over" ? (
          <GameOverScreen snap={snap} meId={me?.id} />
        ) : game.paused ? (
          <PausedScreen />
        ) : (
          <>
            {game.phase === "lobby" && me && <WaitingRoom snap={snap} me={me} />}
            {game.phase === "role_reveal" && me && <RoleRevealScreen snap={snap} me={me} />}
            {me && !me.is_alive && game.phase === "night" && <DeadScreen />}
            {me && !me.is_alive && ["morning", "day", "voting", "vote_result"].includes(game.phase) && (
              <DeadScreen compact />
            )}
            {game.phase === "night" && me?.is_alive && <NightScreen snap={snap} me={me} />}
            {game.phase === "morning" && <MorningAnnouncement snap={snap} />}
            {game.phase === "day" && me && <DayScreen snap={snap} me={me} />}
            {game.phase === "voting" && me && <VoteScreen snap={snap} me={me} />}
            {game.phase === "vote_result" && <VoteResult snap={snap} />}
            {/* Dead players spectate the pack's chat (read-only) whenever there is a pack. */}
            {me && !me.is_alive && game.role_counts.werewolf >= 2 && (
              <WolfChat snap={snap} meId={me.id} canSend={false} note="You're dead — you can listen to the pack, but not speak." />
            )}
          </>
        )}
      </main>
    </>
  );
}
