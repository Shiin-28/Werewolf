"use client";

import { createContext, useContext } from "react";
import { Minus, Plus } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-red-950 bg-linear-to-b from-[#c8151e] to-[#6e070c] text-[#fff3f0] " +
    "shadow-[0_0_24px_-8px_var(--glow)] hover:shadow-[0_0_32px_-4px_var(--glow)]",
  secondary: "border border-line bg-card/60 text-fg hover:border-accent hover:text-accent",
  danger: "border border-red-600 bg-red-950 text-red-100 hover:bg-red-900",
  ghost: "text-fg hover:bg-line/40",
};

export function Button({
  variant = "primary",
  big = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md font-display font-normal tracking-wider transition",
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:grayscale",
        big ? "min-h-16 w-full px-6 text-xl uppercase" : "min-h-11 px-4 text-sm uppercase",
        VARIANTS[variant],
        className,
      ].join(" ")}
    />
  );
}

export function Card({ title, ja, children, className = "" }: {
  title?: string;
  ja?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-card/90 p-4 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.85)] ${className}`}
    >
      {title && (
        <h2 className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
          <span className="font-display text-sm font-normal uppercase tracking-[0.18em]">{title}</span>
          {ja && <span className="whitespace-nowrap font-jp text-sm text-accent">{ja}</span>}
        </h2>
      )}
      {children}
    </section>
  );
}

const STEP_BTN =
  "grid size-11 place-items-center rounded-md border border-line hover:border-accent hover:text-accent disabled:opacity-25 disabled:hover:border-line disabled:hover:text-fg";

export function Stepper({ label, sub, value, min = 0, max = 99, onChange, icon }: {
  label: string;
  sub?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-tight">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={STEP_BTN}>
        <Minus className="size-5" />
      </button>
      <span className="w-8 text-center font-display text-2xl font-normal tabular-nums">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={STEP_BTN}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}

export function Toggle({ label, sub, checked, onChange }: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-tight">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-8 w-14 shrink-0 rounded-md border border-line bg-bg transition peer-checked:border-red-950 peer-checked:bg-accent peer-checked:shadow-[0_0_16px_-4px_var(--glow)] after:absolute after:left-1 after:top-1 after:size-5.5 after:rounded-sm after:bg-muted after:transition peer-checked:after:translate-x-6 peer-checked:after:bg-accent-fg" />
    </label>
  );
}

export function Notice({ tone = "info", children }: {
  tone?: "info" | "error" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-line bg-line/40",
    error: "border-red-600 bg-red-700/15",
    warn: "border-amber-600 bg-amber-600/15",
    ok: "border-emerald-700 bg-emerald-700/15",
  };
  return <div className={`rounded-sm border-l-4 px-4 py-3 text-sm text-fg ${tones[tone]}`}>{children}</div>;
}

/**
 * True on the GM screens: on desktop the page becomes two columns (controls + game log / setup),
 * and the header / bottom bar line up with the left column.
 */
export const WideLayout = createContext(false);

/** Width classes for content that should match the current layout's main column. */
export function useColumnClass() {
  // Matches the GM page grid: 16px side padding, then a 380px log column + 24px gap on the right.
  return useContext(WideLayout) ? "max-w-xl lg:max-w-6xl lg:pl-4 lg:pr-[420px]" : "max-w-xl";
}

/** Sticky bottom area for the one big "what happens next" button. */
export function BottomBar({ children, hint }: { children: React.ReactNode; hint?: string }) {
  const column = useColumnClass();
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-accent/40 bg-card/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className={`mx-auto grid gap-2 ${column}`}>
        {children}
        {hint && <p className="text-center text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-normal uppercase tracking-[0.15em]">{title}</h1>
      {children}
    </main>
  );
}
