"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Shared across components so StrictMode's double effects can't create two anonymous users.
let sessionPromise: Promise<string> | null = null;

async function ensureSession(): Promise<string> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signedIn, error } = await sb.auth.signInAnonymously();
  if (error || !signedIn.user) throw new Error(error?.message ?? "Anonymous sign-in failed");
  return signedIn.user.id;
}

/** Gives this device a stable anonymous identity (survives refreshes). */
export function useAnonAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sessionPromise ??= ensureSession().catch((e) => {
      sessionPromise = null;
      throw e;
    });
    sessionPromise.then(
      (id) => !cancelled && setUserId(id),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { userId, error };
}
