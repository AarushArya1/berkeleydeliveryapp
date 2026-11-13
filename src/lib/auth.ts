import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export function isOnboarded(p: Profile) {
  return Boolean(p.full_name && p.dorm && p.phone && p.sms_consent_at && p.tos_accepted_at && p.home_screen_at);
}

export function isRunnerReady(p: Profile) {
  return Boolean(p.runner_terms_accepted_at && p.payouts_ready_at);
}

/** The signed-in user's id, or null. Verifies the JWT. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

/** Signed-in user + profile, or redirect to login. */
export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, userId, profile };
}

/** Like getViewer, but also requires sign-up to be finished. */
export async function getMember() {
  const viewer = await getViewer();
  if (!isOnboarded(viewer.profile)) redirect("/onboarding");
  return viewer;
}
