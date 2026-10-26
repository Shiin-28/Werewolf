"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { Button, Card } from "@/components/ui";

export function SharePanel({ code }: { code: string }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(true);

  useEffect(() => setLink(`${window.location.origin}/join/${code}`), [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Card title="Invite players" ja="招待">
      <div className="text-center">
        <p className="font-mono text-5xl font-extrabold tracking-[0.2em] text-accent drop-shadow-[0_0_14px_var(--glow)]">{code}</p>
        <p className="mt-1 break-all text-sm text-muted">{link}</p>
      </div>
      {showQr && link && (
        <div className="mx-auto mt-4 w-fit rounded-md border-4 border-accent/70 bg-[#f3ece6] p-3">
          <QRCodeSVG value={link} size={200} marginSize={0} fgColor="#0a0405" bgColor="#f3ece6" />
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="secondary"
          disabled={!canShare}
          onClick={() => navigator.share?.({ title: "Join my Werewolf game", url: link }).catch(() => {})}
        >
          <Share2 className="size-5" /> Share
        </Button>
        <Button variant="secondary" onClick={() => setShowQr((s) => !s)}>
          <QrCode className="size-5" /> {showQr ? "Hide" : "QR"}
        </Button>
      </div>
    </Card>
  );
}
