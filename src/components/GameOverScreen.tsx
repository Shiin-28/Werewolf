import { Skull, Sun } from "lucide-react";
import { TEAMS } from "@/lib/roles";
import type { Snapshot } from "@/lib/types";
import { Card } from "@/components/ui";
import { WolfPaw } from "@/components/icons/WolfPaw";
import { RevealList } from "./RevealList";

/** Shared by players and the GM: who won (if anyone) and every role revealed. */
export function GameOverScreen({ snap, meId }: { snap: Snapshot; meId?: string }) {
  const { winner } = snap.game;
  const ending =
    winner === "village"
      ? {
          icon: <Sun className="mx-auto size-16 text-amber-600 drop-shadow-[0_0_18px_rgb(217_119_6/0.5)]" aria-hidden />,
          line: "Dawn breaks — every werewolf is dead.",
          ja: "夜が明けた。人狼はすべて倒された。",
        }
      : winner === "werewolf"
        ? {
            icon: <WolfPaw className="mx-auto size-16 animate-flicker text-accent" aria-hidden />,
            line: "The wolves feast — the village has fallen.",
            ja: "村は人狼に滅ぼされた。",
          }
        : {
            icon: <Skull className="mx-auto size-16 text-accent" aria-hidden />,
            line: "The GM ended the game early.",
            ja: "ゲームは途中で終了しました。",
          };

  return (
    <>
      <Card className="py-8 text-center">
        {ending.icon}
        <p className="mt-3 font-display text-4xl uppercase tracking-[0.12em]">
          {winner ? `${TEAMS[winner].name} win` : "Game ended"}
        </p>
        <p className="font-jp text-accent">{winner ? `${TEAMS[winner].ja}の勝利` : "ゲーム終了"}</p>
        <p className="mt-3 text-muted">{ending.line}</p>
        <p className="font-jp text-sm text-muted">{ending.ja}</p>
      </Card>
      <Card title="All roles" ja="役職公開">
        <RevealList players={snap.players} meId={meId} />
      </Card>
    </>
  );
}
