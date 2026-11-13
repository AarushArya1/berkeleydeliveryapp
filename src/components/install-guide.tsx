"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Share, SquarePlus } from "lucide-react";
import { detectPlatform, isStandalone, type Platform } from "@/lib/platform";
import { useClientValue } from "@/lib/use-client-value";
import { Button } from "./ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let cached: { platform: Platform; standalone: boolean } | null = null;
const readInstall = () => (cached ??= { platform: detectPlatform(), standalone: isStandalone() });

/** null during server render / first paint. */
export function useInstallState() {
  return useClientValue(readInstall, null);
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-lime-200 text-sm font-extrabold text-lime-900">
        {n}
      </span>
      <span className="pt-0.5 text-[15px] leading-relaxed text-ink">{children}</span>
    </li>
  );
}

/** Steps to add Dart to the home screen (needed for push notifications on iPhone). */
export function InstallGuide({ platform }: { platform: Platform }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === "ios") {
    return (
      <ol className="space-y-3.5">
        <Step n={1}>
          Tap <Share className="inline size-[18px] -translate-y-0.5 text-action" /> <b>Share</b> in Safari&apos;s toolbar
        </Step>
        <Step n={2}>
          Choose <SquarePlus className="inline size-[18px] -translate-y-0.5 text-action" /> <b>Add to Home Screen</b>
        </Step>
        <Step n={3}>
          Open <b>Dart</b> from your home screen and sign in there
        </Step>
      </ol>
    );
  }

  if (platform === "android") {
    return (
      <div className="space-y-4">
        {prompt ? (
          <Button full size="lg" onClick={() => prompt.prompt()}>
            Add Dart to home screen
          </Button>
        ) : (
          <ol className="space-y-3.5">
            <Step n={1}>
              Tap <MoreVertical className="inline size-[18px] -translate-y-0.5 text-action" /> in Chrome
            </Step>
            <Step n={2}>
              Choose <b>Add to Home screen</b> or <b>Install app</b>
            </Step>
            <Step n={3}>
              Open <b>Dart</b> from your home screen and sign in there
            </Step>
          </ol>
        )}
      </div>
    );
  }

  return (
    <p className="text-[15px] leading-relaxed text-muted">
      Dart is built for your phone. Open this page on your phone to add it to your home screen. You can keep testing on this computer.
    </p>
  );
}
