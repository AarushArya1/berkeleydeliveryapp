import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { getMember } from "@/lib/auth";
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
  const { profile } = await getMember();
  return (
    <RunnerSetup
      termsDone={Boolean(profile.runner_terms_accepted_at)}
      venmo={profile.venmo_username}
      zelle={profile.zelle_contact}
      budgetCents={profile.runner_budget_cents}
    />
  );
}
