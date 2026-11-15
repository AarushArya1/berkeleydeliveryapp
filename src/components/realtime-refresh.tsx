"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when matching `requests` rows change, so both people on
 * an order see each step as it happens.
 */
export function RealtimeRefresh({ channel, filter }: { channel: string; filter?: string }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    let cancelled = false;
    createClient()
      .then((supabase) => {
        if (cancelled) return;
        const sub = supabase
          .channel(channel)
          .on("postgres_changes", { event: "*", schema: "public", table: "requests", ...(filter ? { filter } : {}) }, () => {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 250);
          })
          .subscribe();
        stop = () => void supabase.removeChannel(sub);
      })
      .catch(() => {}); // live updates are a nicety; refresh-on-focus still works
    const onFocus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      stop?.();
    };
  }, [channel, filter, router]);
  return null;
}
