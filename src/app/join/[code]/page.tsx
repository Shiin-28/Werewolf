"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import type { Lookup } from "@/lib/enterGame";
import { useNickname } from "@/lib/nickname";
import { rpc } from "@/lib/supabase";
import { FullScreenMessage, Notice } from "@/components/ui";
import { NicknameForm } from "@/components/NicknameForm";

export default function JoinPage() {
  const router = useRouter();
  const code = (useParams<{ code: string }>().code ?? "").toUpperCase();
  const { userId, error: authError } = useAnonAuth();
  const { nickname, ready, setNickname } = useNickname();
  const [lookup, setLookup] = useState<Lookup | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    rpc<Lookup | null>("lookup_game", { p_code: code }).then(
      (l) => {
        // Already seated (or the GM)? Skip straight to the right screen.
        if (l?.is_gm) router.replace(`/gm/${code}`);
        else if (l?.my_player_id) router.replace(`/play/${code}`);
        else setLookup(l);
      },
      (e: Error) => setError(e.message),
    );
  }, [userId, code, router]);

  async function join(name: string) {
    setNickname(name);
    setBusy(true);
    setError(null);
    try {
      await rpc("join_game", { p_code: code, p_name: name });
      router.replace(`/play/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (authError) return <FullScreenMessage title="Couldn't connect">{authError}</FullScreenMessage>;
  if ((lookup === undefined && !error) || !ready) return <FullScreenMessage title="Finding game…" />;
  if (lookup === null)
    return (
      <FullScreenMessage title="Game not found">
        <p className="text-muted">No game with code <b className="font-mono">{code}</b>.</p>
        <Link href="/" className="text-accent underline">Back</Link>
      </FullScreenMessage>
    );
  if (lookup && lookup.phase !== "lobby")
    return (
      <FullScreenMessage title="Game already started">
        <p className="text-muted">You can only join while the GM is in the lobby.</p>
        <Link href="/" className="text-accent underline">Back</Link>
      </FullScreenMessage>
    );

  const full = lookup ? lookup.joined >= lookup.player_count : false;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-muted">
          Joining game <span className="font-jp text-accent">参加</span>
        </p>
        <p className="font-mono text-4xl font-extrabold tracking-[0.25em] text-accent drop-shadow-[0_0_14px_var(--glow)]">
          {code}
        </p>
        {lookup && (
          <p className="mt-1 text-muted">
            {lookup.joined}/{lookup.player_count} players
          </p>
        )}
      </div>
      <NicknameForm
        initial={nickname}
        submitLabel={full ? "Lobby is full" : "Join game"}
        busy={busy}
        disabled={full}
        onSubmit={join}
      />
      {error && <Notice tone="error">{error}</Notice>}
    </main>
  );
}
