"use client";

import { useState } from "react";
import { BellRing, Sparkles } from "lucide-react";
import { detectPlatform, isStandalone } from "@/lib/platform";
import { useClientValue } from "@/lib/use-client-value";
import { PushButton } from "./push-button";
import { Card, Notice } from "./ui";

type PushState = "granted" | "denied" | "default" | "unsupported" | "needs-install";

function readPushState(): PushState {
  // iPhone only allows notifications once Dart is opened from the home screen.
  if (detectPlatform() === "ios" && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Shown on the requester's order while it waits for (or just got) a runner:
 * asks them to turn on notifications if they haven't on this device.
 */
export function NotifyPrompt({ posted }: { posted: boolean }) {
  const state = useClientValue(readPushState, null);
  const [turnedOn, setTurnedOn] = useState(false);

  if (state === null) return null;

  if (state === "granted" || turnedOn) {
    return posted ? (
      <Notice tone="lime" className="animate-rise">
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4" /> Posted! We&apos;ll notify you the moment a runner picks it up.
        </span>
      </Notice>
    ) : null;
  }

  return (
    <Card className="animate-rise space-y-3 border-action/25 bg-action-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-action">
          <BellRing className="size-5" />
        </span>
        <div>
          <p className="font-extrabold leading-snug text-action-ink">
            {posted ? "Posted! Now turn on notifications" : "Turn on notifications"}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-action-ink/80">
            {state === "needs-install"
              ? "Add Dart to your home screen to get a notification the moment a runner picks up your order. We'll still text you."
              : "So you know the moment a runner picks up your order and when it's on the way."}
          </p>
        </div>
      </div>
      {state === "needs-install" ? null : state === "denied" ? (
        <p className="text-xs text-action-ink/80">Notifications are blocked for Dart. Turn them on in your phone&apos;s Settings.</p>
      ) : state === "unsupported" ? (
        <p className="text-xs text-action-ink/80">This browser can&apos;t show notifications. We&apos;ll text you instead.</p>
      ) : (
        <PushButton onDone={(r) => setTurnedOn(r === "granted")} />
      )}
    </Card>
  );
}
