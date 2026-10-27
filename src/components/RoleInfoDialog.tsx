"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ROLES, TEAMS } from "@/lib/roles";
import type { RoleId } from "@/lib/types";
import { Button } from "./ui";

/** What a role does, shown as a modal. Tap outside, Close or Escape to dismiss. */
export function RoleInfoDialog({ role, onClose }: { role: RoleId | null; onClose: () => void }) {
  useEffect(() => {
    if (!role) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role, onClose]);

  if (!role) return null;
  const info = ROLES[role];
  const team = TEAMS[info.team];
  const Icon = info.icon;

  // Portal to <body>: an ancestor with backdrop-filter (the sticky header) would otherwise trap `fixed`.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-info-title"
        className={`flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/50 p-5 shadow-[0_0_48px_-12px_var(--glow)] ${info.card}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-md border border-current/30 bg-black/25">
            <Icon className="size-8" aria-hidden />
          </span>
          <div>
            <h2 id="role-info-title" className="font-display text-3xl uppercase leading-none tracking-[0.08em]">
              {info.name}
            </h2>
            <p className="font-jp text-lg">{info.ja}</p>
          </div>
        </div>

        <p className="w-fit rounded-sm bg-black/30 px-2 py-1 text-sm uppercase tracking-wider">
          Team: {team.name} <span className="font-jp normal-case">{team.ja}</span>
          {info.max && <span className="normal-case"> · max {info.max}</span>}
        </p>
        <p className="leading-snug">{info.description}</p>
        <p className="border-l-2 border-current/50 pl-3 text-sm leading-snug">
          <span className="font-display uppercase tracking-wider">How to win · </span>
          {info.win}
        </p>

        <Button variant="secondary" onClick={onClose} autoFocus className="bg-black/30">
          Close
        </Button>
      </div>
    </div>,
    document.body,
  );
}
