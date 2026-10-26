"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Crown, LogIn, Pencil } from "lucide-react";
import { WolfPaw } from "@/components/icons/WolfPaw";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import { enterGame } from "@/lib/enterGame";
import { useNickname } from "@/lib/nickname";
import { rpc } from "@/lib/supabase";
import { Button, Card, Notice } from "@/components/ui";
import { NicknameForm } from "@/components/NicknameForm";

export default function Home() {
  const router = useRouter();
  const { userId, error: authError } = useAnonAuth();
  const { nickname, ready, setNickname } = useNickname();
  const [editingName, setEditingName] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  const askName = ready && (!nickname || editingName);

  async function go(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      router.push(await action());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-12">
      <div className="mb-4 text-center">
        <WolfPaw className="mx-auto size-24 animate-flicker text-accent" aria-hidden />
        <h1 className="mt-2">
          <Image
            src="/werewolf-logo.png"
            alt="Werewolf"
            width={974}
            height={319}
            loading="eager"
            fetchPriority="high"
            className="mx-auto h-auto w-full max-w-sm drop-shadow-[0_0_22px_var(--glow)]"
          />
        </h1>
        <p className="mt-2 text-sm italic text-muted">
          Trust no one. <span className="font-jp not-italic">誰も信じるな。</span>
        </p>
      </div>

      {askName && (
        <NicknameForm
          initial={nickname}
          submitLabel={nickname ? "Save" : "Start"}
          onSubmit={(n) => {
            setNickname(n);
            setEditingName(false);
          }}
        />
      )}

      {ready && !askName && (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-line bg-card/90 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Playing as</p>
              <p className="truncate font-display text-2xl uppercase tracking-[0.08em]">{nickname}</p>
            </div>
            <Button variant="secondary" onClick={() => setEditingName(true)}>
              <Pencil className="size-4" /> Change
            </Button>
          </div>

          <Card title="Join a game" ja="参加する">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (cleanCode.length === 6) void go(() => enterGame(cleanCode, nickname));
              }}
            >
              <input
                value={cleanCode}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCDEF"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Lobby code"
                className="h-16 rounded-md border border-line bg-bg text-center font-mono text-3xl font-bold uppercase tracking-[0.3em] outline-none placeholder:text-line focus:border-accent focus:shadow-[0_0_20px_-6px_var(--glow)]"
              />
              <Button type="submit" big disabled={cleanCode.length !== 6 || !userId || busy}>
                <LogIn className="size-6" /> Join
              </Button>
            </form>
          </Card>

          <Card title="Host a game" ja="ゲームマスター">
            <p className="mb-3 text-sm text-muted">
              The GM narrates and controls the game. The GM is not a player.
            </p>
            <Button
              big
              variant="secondary"
              disabled={!userId || busy}
              onClick={() => go(async () => `/gm/${await rpc<string>("create_game")}`)}
            >
              <Crown className="size-6" /> Create game
            </Button>
          </Card>
        </>
      )}

      {(authError || error) && <Notice tone="error">{authError ?? error}</Notice>}
    </main>
  );
}
