import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { getMember } from "@/lib/auth";
import type { Card, CardLoad } from "@/lib/types";
import { RunnerSetup } from "./setup";

export const metadata = { title: "Runner setup · Dart" };

export default function RunnerSetupPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  const { supabase, userId, profile } = await getMember();
  const [{ data: card }, { data: loads }] = await Promise.all([
    supabase.from("cards").select("*").eq("runner_id", userId).maybeSingle<Card>(),
    supabase.from("card_loads").select("*").eq("runner_id", userId).eq("status", "loaded").returns<CardLoad[]>(),
  ]);
  return (
    <RunnerSetup
      termsDone={Boolean(profile.runner_terms_accepted_at)}
      payoutsDone={Boolean(profile.payouts_ready_at)}
      card={profile.card_issued_at ? (card ?? null) : null}
      loads={loads ?? []}
    />
  );
}
