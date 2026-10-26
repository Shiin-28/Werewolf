import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Instant "something changed, refetch" pings between the devices in a game.
 *
 * Broadcast messages skip the database-change feed (which checks RLS per device and can lag),
 * so phase changes reach every phone right away. They carry no data — each device still
 * refetches only what RLS lets it see.
 */
let channel: RealtimeChannel | null = null;
let refreshSelf: (() => void) | null = null;

export function registerLiveChannel(c: RealtimeChannel, refresh: () => void) {
  channel = c;
  refreshSelf = refresh;
}

export function unregisterLiveChannel(c: RealtimeChannel) {
  if (channel !== c) return;
  channel = null;
  refreshSelf = null;
}

/** Refresh this device now and tell every other device in the game to do the same. */
export function nudgeEveryone() {
  refreshSelf?.();
  void channel?.send({ type: "broadcast", event: "refresh", payload: {} });
}
