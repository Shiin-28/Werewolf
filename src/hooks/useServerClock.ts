"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";

let offsetPromise: Promise<number> | null = null;

/** Milliseconds to add to Date.now() to get the server's clock, so every device's countdown agrees. */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    offsetPromise ??= (async () => {
      const t0 = Date.now();
      const server = await rpc<string>("server_now");
      const t1 = Date.now();
      return new Date(server).getTime() - (t0 + t1) / 2;
    })().catch(() => 0);
    let alive = true;
    offsetPromise.then((o) => alive && setOffset(o));
    return () => {
      alive = false;
    };
  }, []);
  return offset;
}

/** Seconds left until `endsAt` on the server clock (0 when done, null when no timer). */
export function useSecondsLeft(endsAt: string | null): number | null {
  const offset = useServerOffset();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - (now + offset)) / 1000));
}
