"use client";

import { useCallback, useState } from "react";
import { rpc } from "@/lib/supabase";

/** Busy/error state around one-shot RPC calls from buttons. */
export function useRpc() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await rpc(fn, args);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run };
}
