import { Pause } from "lucide-react";
import { Card } from "@/components/ui";

export function PausedScreen() {
  return (
    <Card className="py-10 text-center">
      <Pause className="mx-auto size-16 text-amber-500" aria-hidden />
      <p className="mt-4 font-display text-3xl uppercase tracking-[0.15em]">Game paused</p>
      <p className="font-jp text-accent">一時停止中</p>
      <p className="mt-3 text-sm text-muted">Hold on — the GM will resume the game shortly.</p>
    </Card>
  );
}
