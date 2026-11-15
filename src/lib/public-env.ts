"use client";

import { normalizeSupabaseUrl } from "./supabase/env";

export type PublicEnv = { supabaseUrl: string; supabaseKey: string; vapidPublicKey: string };

let pending: Promise<PublicEnv> | null = null;

/**
 * Public settings for browser code. Uses the values baked in at build time
 * when there are any; otherwise asks the server once (runtime variables).
 */
export function publicEnv(): Promise<PublicEnv> {
  const built: PublicEnv = {
    supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  };
  if (built.supabaseUrl && built.supabaseKey && built.vapidPublicKey) return Promise.resolve(built);
  pending ??= fetch("/api/public-env", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PublicEnv>) : Promise.reject(new Error(`public-env ${r.status}`))))
    .then((remote) => ({
      supabaseUrl: built.supabaseUrl || remote.supabaseUrl,
      supabaseKey: built.supabaseKey || remote.supabaseKey,
      vapidPublicKey: built.vapidPublicKey || remote.vapidPublicKey,
    }))
    .catch((e) => {
      pending = null; // try again next time
      throw e;
    });
  return pending;
}
