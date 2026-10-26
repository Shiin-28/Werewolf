import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nudgeEveryone } from "./live";

let client: SupabaseClient | null = null;

/** In `next dev`, each tab gets its own anonymous identity so tabs can act as different players. */
export const PER_TAB_IDENTITY =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PER_TAB_IDENTITY !== "false";

/** Browser-only Supabase client (all pages are client components). */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase's dashboard now calls it the "publishable" key; older projects call it "anon".
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "ww-auth",
      storage: PER_TAB_IDENTITY ? window.sessionStorage : window.localStorage,
    },
  });
  return client;
}

/**
 * Calls that must NOT ping other devices: secret actions (a ping's timing could hint who
 * acted) and read-only lookups. Everything else changes public state, so everyone refreshes.
 */
const NO_NUDGE = new Set(["night_action", "send_wolf_message", "lookup_game", "server_now"]);

/** Calls a Postgres function and throws its error message (which is written for humans). */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  if (!NO_NUDGE.has(fn)) nudgeEveryone();
  return data as T;
}
