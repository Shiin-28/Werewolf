import { Skull } from "lucide-react";
import { Card } from "@/components/ui";

export function DeadScreen({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex items-center gap-3 rounded-md border border-accent/50 bg-accent/10 px-4 py-3">
        <Skull className="size-6 shrink-0 text-accent" aria-hidden />
        <p className="text-sm">
          <b className="font-display uppercase tracking-wider">You are dead.</b> Stay silent — you can&apos;t act or vote.
        </p>
      </div>
    );
  return (
    <Card className="py-10 text-center">
      <Skull className="mx-auto size-16 text-accent" aria-hidden />
      <p className="mt-4 font-display text-3xl uppercase tracking-[0.15em]">You are dead</p>
      <p className="font-jp text-accent">あなたは死亡しました</p>
      <p className="mt-3 text-sm text-muted">Stay silent. You can watch, but you can no longer act or vote.</p>
    </Card>
  );
}
