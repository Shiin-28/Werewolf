"use client";

import { useCallback, useEffect, useState } from "react";
import { PER_TAB_IDENTITY } from "./supabase";

const KEY = "ww-nickname";
export const NICKNAME_MAX = 20;

// Same storage as the auth session, so in dev each tab keeps its own nickname too.
function storage(): Storage | null {
  try {
    return PER_TAB_IDENTITY ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function cleanNickname(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX);
}

/** The nickname remembered on this device. `ready` is false until it has been read (avoids a flash). */
export function useNickname() {
  const [nickname, setState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setState(storage()?.getItem(KEY) ?? "");
    } catch {}
    setReady(true);
  }, []);

  const setNickname = useCallback((raw: string) => {
    const clean = cleanNickname(raw);
    setState(clean);
    try {
      storage()?.setItem(KEY, clean);
    } catch {}
  }, []);

  return { nickname, ready, setNickname };
}
