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
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = supabase
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests", ...(filter ? { filter } : {}) }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 250);
      })
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      supabase.removeChannel(sub);
    };
  }, [channel, filter, router]);
  return null;
}
