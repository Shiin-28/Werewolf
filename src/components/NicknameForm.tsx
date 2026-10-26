"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { NICKNAME_MAX, cleanNickname } from "@/lib/nickname";
import { Button, Card } from "@/components/ui";

/** "Choose your nickname" card with one big button. The player always types the name themselves. */
export function NicknameForm({ initial = "", submitLabel, busy = false, disabled = false, onSubmit }: {
  initial?: string;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (nickname: string) => void;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial]);
  const clean = cleanNickname(name);

  return (
    <Card>
      <form
        className="flex flex-col items-center gap-4 py-2 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean && !busy && !disabled) onSubmit(clean);
        }}
      >
        <div>
          <p className="font-display text-xl uppercase tracking-[0.15em]">Choose your nickname</p>
          <p className="font-jp text-sm text-accent">ニックネームを入力</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NICKNAME_MAX}
          autoFocus
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder="Your nickname"
          aria-label="Nickname"
          className="h-16 w-full rounded-md border border-line bg-bg px-4 text-center text-2xl outline-none placeholder:text-muted/50 focus:border-accent focus:shadow-[0_0_20px_-6px_var(--glow)]"
        />
        <Button type="submit" big disabled={!clean || busy || disabled}>
          <Play className="size-6" /> {submitLabel}
        </Button>
      </form>
    </Card>
  );
}
