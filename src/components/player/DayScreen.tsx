import { MessagesSquare } from "lucide-react";
import type { Player, Snapshot } from "@/lib/types";
import { Card } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { MorningAnnouncement } from "@/components/Announcements";
import { MyRolePanel } from "./MyRolePanel";

export function DayScreen({ snap, me }: { snap: Snapshot; me: Player }) {
  return (
    <>
      <Countdown endsAt={snap.game.timer_ends_at} />
      <Card className="py-6 text-center">
        <MessagesSquare className="mx-auto size-12 text-accent" aria-hidden />
        <p className="mt-2 font-display text-2xl uppercase tracking-[0.12em]">Discuss</p>
        <p className="font-jp text-sm text-accent">議論の時間です</p>
        <p className="mt-2 text-muted">
          {me.is_alive ? "Who is lying? Find the werewolves before voting starts." : "Listen in silence."}
        </p>
      </Card>
      <MorningAnnouncement snap={snap} compact />
      <MyRolePanel snap={snap} me={me} />
    </>
  );
}
