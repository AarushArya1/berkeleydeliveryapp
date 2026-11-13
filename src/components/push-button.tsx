"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { savePushSubscription } from "@/app/actions";
import { enablePush, type PushResult } from "@/lib/platform";
import { Button } from "./ui";

export function PushButton({ onDone, variant = "primary" }: { onDone?: (r: PushResult) => void; variant?: "primary" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  async function go() {
    setBusy(true);
    try {
      const r = await enablePush(savePushSubscription);
      setResult(r);
      onDone?.(r);
    } finally {
      setBusy(false);
    }
  }

  if (result === "granted") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-lime-700">
        <BellRing className="size-4" /> Notifications are on
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <Button full variant={variant} onClick={go} loading={busy}>
        <Bell className="size-4" /> Turn on notifications
      </Button>
      {result === "denied" ? (
        <p className="text-xs text-muted">Notifications are blocked. Turn them on for Dart in your phone&apos;s Settings.</p>
      ) : null}
      {result === "unsupported" ? (
        <p className="text-xs text-muted">This browser can&apos;t do push notifications. On iPhone, open Dart from your home screen.</p>
      ) : null}
    </div>
  );
}
