"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** `const [confirm, dialog] = useConfirm()` → `if (await confirm({...})) doIt()`; render `{dialog}`. */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  // Portal to <body>: an ancestor with backdrop-filter (the sticky header) would otherwise trap `fixed`.
  const dialog = opts ? createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => close(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-accent/60 bg-card p-5 text-fg shadow-[0_0_48px_-12px_var(--glow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-normal uppercase tracking-[0.1em]">{opts.title}</h2>
        {opts.message && <p className="mt-2 text-muted">{opts.message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={opts.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {opts.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return [confirm, dialog] as const;
}
