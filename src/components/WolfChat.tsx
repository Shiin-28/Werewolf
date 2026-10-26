"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Send } from "lucide-react";
import { rpc } from "@/lib/supabase";
import { playerName } from "@/lib/selectors";
import type { Snapshot } from "@/lib/types";
import { Notice } from "@/components/ui";
import { WolfPaw } from "@/components/icons/WolfPaw";

const MAX = 200;

/**
 * The pack's private chat. Living wolves write during their turn; the GM and dead players read along.
 * Rows only reach devices RLS allows, so rendering it elsewhere would simply show nothing.
 */
export function WolfChat({ snap, meId, canSend, note }: {
  snap: Snapshot;
  meId?: string;
  canSend: boolean;
  /** Shown instead of the input when the viewer can't write. */
  note?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = snap.wolfMessages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rpc("send_wolf_message", { p_game: snap.game.id, p_body: body });
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-accent/50 bg-black/40 p-3 shadow-[0_0_30px_-12px_var(--glow)]">
      <h2 className="mb-2 flex items-center gap-2">
        <WolfPaw className="size-5 text-accent" aria-hidden />
        <span className="flex-1 font-display text-sm uppercase tracking-[0.15em]">Pack chat</span>
        <span className="font-jp text-xs text-accent">人狼の会話</span>
      </h2>

      <div ref={listRef} className="flex max-h-64 min-h-24 flex-col gap-1.5 overflow-y-auto pr-1 text-sm">
        {messages.length === 0 && <p className="m-auto text-muted italic">No words yet…</p>}
        {messages.map((m, i) => {
          const newNight = i === 0 || messages[i - 1].round !== m.round;
          const mine = m.sender_player_id === meId;
          return (
            <div key={m.id}>
              {newNight && (
                <p className="my-1 text-center font-display text-[10px] uppercase tracking-[0.3em] text-muted">Night {m.round}</p>
              )}
              <p className={`rounded-md px-2.5 py-1.5 ${mine ? "ml-8 bg-accent/25" : "mr-8 bg-line/40"}`}>
                <span className="mr-1.5 font-semibold text-accent">{mine ? "You" : playerName(snap, m.sender_player_id)}</span>
                <span className="break-words">{m.body}</span>
              </p>
            </div>
          );
        })}
      </div>

      {canSend ? (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            enterKeyHint="send"
            placeholder="Whisper to the pack…"
            aria-label="Message the pack"
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send"
            className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-accent-fg disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </form>
      ) : (
        note && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" aria-hidden /> {note}
          </p>
        )
      )}
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
    </section>
  );
}
