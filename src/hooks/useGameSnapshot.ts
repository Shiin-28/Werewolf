"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerLiveChannel, unregisterLiveChannel } from "@/lib/live";
import type { Game, Snapshot } from "@/lib/types";
import { normalizeCounts } from "@/lib/selectors";

type Status = "loading" | "ready" | "not_found" | "error";

const REFETCH_DEBOUNCE_MS = 60;
const SAFETY_POLL_MS = 30_000;
/** Poll this often while the live connection is down, so the lobby never lags far behind. */
const FALLBACK_POLL_MS = 3_000;
const SECRET_AND_PUBLIC_TABLES = ["players", "events", "player_roles", "night_actions", "votes"] as const;

/**
 * Live view of a game, limited to what RLS lets this device see.
 * Any realtime change → debounced refetch of the whole (small) snapshot, so we never
 * drift out of sync after a dropped connection. Also refetches on "refresh" broadcast
 * pings (sent after every public action — see lib/live.ts — and on connect), on tab
 * focus, and on a safety poll (fast while live updates are down).
 */
export function useGameSnapshot(code: string, userId: string | null) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const gameIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** True once the server confirms the database subscription; false while it is down. */
  const liveRef = useRef(false);
  const requestSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    const seq = ++requestSeq.current;
    const sb = supabase();
    // First load: find the game by code. After that we know its id, so every query runs at once.
    let id = gameIdRef.current;
    if (!id) {
      const { data, error: gErr } = await sb.from("games").select("id").eq("code", code.toUpperCase()).maybeSingle();
      if (seq !== requestSeq.current) return;
      if (gErr) {
        setError(gErr.message);
        setStatus("error");
        return;
      }
      id = data?.id ?? null;
    }
    if (!id) {
      // Either the code is wrong, or this device is no longer in the game (e.g. kicked).
      setSnap(null);
      setStatus("not_found");
      return;
    }

    const [gameRes, players, events, roles, nightActions, votes, wolfMessages] = await Promise.all([
      sb.from("games").select("*").eq("id", id).maybeSingle<Game>(),
      sb.from("players").select("*").eq("game_id", id).order("seat"),
      sb.from("events").select("*").eq("game_id", id).order("id"),
      sb.from("player_roles").select("*").eq("game_id", id),
      sb.from("night_actions").select("*").eq("game_id", id).order("round"),
      sb.from("votes").select("*").eq("game_id", id),
      sb.from("wolf_messages").select("*").eq("game_id", id).order("id"),
    ]);
    if (seq !== requestSeq.current) return;
    const game = gameRes.data;
    if (gameRes.error) {
      setError(gameRes.error.message);
      setStatus("error");
      return;
    }
    if (!game) {
      gameIdRef.current = null;
      setSnap(null);
      setStatus("not_found");
      return;
    }
    game.role_counts = normalizeCounts(game.role_counts);
    gameIdRef.current = game.id;
    // The pack chat is an add-on: if it can't load (e.g. its SQL isn't installed yet), the game still works.
    if (wolfMessages.error) console.warn("Pack chat unavailable:", wolfMessages.error.message);
    const firstError = [players, events, roles, nightActions, votes].find((r) => r.error)?.error;
    if (firstError) {
      setError(firstError.message);
      setStatus("error");
      return;
    }
    setSnap({
      game,
      players: players.data ?? [],
      events: events.data ?? [],
      roles: roles.data ?? [],
      nightActions: nightActions.data ?? [],
      votes: votes.data ?? [],
      wolfMessages: wolfMessages.data ?? [],
    });
    setError(null);
    setStatus("ready");
  }, [code]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchSnapshot(), REFETCH_DEBOUNCE_MS);
  }, [fetchSnapshot]);

  // Initial load.
  useEffect(() => {
    if (!userId) return;
    void fetchSnapshot();
  }, [userId, fetchSnapshot]);

  // Realtime subscription, once we know the game id.
  const gameId = snap?.game.id ?? null;
  useEffect(() => {
    if (!userId || !gameId) return;
    const sb = supabase();
    let channel: RealtimeChannel | null = null;
    let chatChannel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      if (data.session) await sb.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = sb.channel(`game:${gameId}`);
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        refresh,
      );
      for (const table of SECRET_AND_PUBLIC_TABLES) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `game_id=eq.${gameId}` },
          refresh,
        );
      }
      channel.on("broadcast", { event: "refresh" }, refresh);
      // The server confirms (or rejects) the database subscription with a "system" message after SUBSCRIBED.
      channel.on("system", {}, (msg: { status?: string }) => {
        liveRef.current = msg.status === "ok";
        if (msg.status === "ok") refresh(); // catch anything missed while (re)connecting
      });
      const ch = channel;
      ch.subscribe((s) => {
        if (s !== "SUBSCRIBED") {
          liveRef.current = false;
          return;
        }
        // Just (re)connected: catch up, and ping the others so e.g. the GM's lobby shows us at once.
        refresh();
        void ch.send({ type: "broadcast", event: "refresh", payload: {} });
      });
      channelRef.current = ch;
      registerLiveChannel(ch, refresh);

      // The pack chat gets its own channel: if its table is missing, only the chat goes quiet.
      chatChannel = sb
        .channel(`game-chat:${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "wolf_messages", filter: `game_id=eq.${gameId}` }, refresh)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      liveRef.current = false;
      if (channel) {
        unregisterLiveChannel(channel);
        void sb.removeChannel(channel);
      }
      if (chatChannel) void sb.removeChannel(chatChannel);
      channelRef.current = null;
    };
  }, [userId, gameId, refresh]);

  // Refetch when the tab comes back, plus a safety poll: slow while live updates work, fast while they don't.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    let last = Date.now();
    const poll = setInterval(() => {
      if (!liveRef.current || Date.now() - last >= SAFETY_POLL_MS) {
        last = Date.now();
        refresh();
      }
    }, FALLBACK_POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      clearInterval(poll);
    };
  }, [userId, refresh]);

  /** Tell every device in the game to refetch (e.g. after deleting a row). */
  const broadcastRefresh = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "refresh", payload: {} });
  }, []);

  return { snap, status, error, refresh, broadcastRefresh };
}
