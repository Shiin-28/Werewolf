"use client";

import { useContext, useEffect } from "react";
import { Moon, Pause, Sun } from "lucide-react";
import type { Banner } from "@/lib/phase";
import { WideLayout } from "./ui";

/** Sticky "what phase is it?" header. Also switches the page between the dark and day themes. */
export function PhaseBanner({
  banner,
  detail,
  paused = false,
  right,
}: {
  banner: Banner;
  detail?: string;
  paused?: boolean;
  right?: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.toggle("theme-day", !banner.dark);
  }, [banner.dark]);

  const wide = useContext(WideLayout);
  const Icon = banner.dark ? Moon : Sun;
  return (
    <header className="sticky top-0 z-20 bg-card/90 backdrop-blur">
      <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-xl lg:max-w-6xl" : "max-w-xl"}`}>
        <Icon className="size-7 shrink-0 animate-flicker text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-normal uppercase leading-tight tracking-[0.12em]">
            {banner.title}
          </h1>
          <p className="truncate text-sm text-muted">
            <span className="font-jp text-accent">{banner.ja}</span>
            {detail ? ` · ${detail}` : ""}
          </p>
        </div>
        {right}
      </div>
      <div className="h-px bg-linear-to-r from-transparent via-accent to-transparent" />
      {paused && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 py-1.5 font-display text-sm font-normal uppercase tracking-widest text-black">
          <Pause className="size-4" aria-hidden /> Game paused <span className="font-jp">一時停止中</span>
        </div>
      )}
    </header>
  );
}
