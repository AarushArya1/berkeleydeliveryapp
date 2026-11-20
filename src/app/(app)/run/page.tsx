import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Timer } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequestRow } from "@/components/request-row";
import { RunnerBudget } from "@/components/runner-budget";
import { Card, Notice, PageSkeleton } from "@/components/ui";
import { getMember, isRunnerReady } from "@/lib/auth";
import { DELIVERY_WINDOW_MINUTES, FEES, LAUNCH_ZONES, runnerBudgetCents } from "@/lib/config";
import { money } from "@/lib/format";
import { runMaintenance } from "@/lib/orders";
import type { CardLoad, DartRequest } from "@/lib/types";
import { Feed } from "./feed";

export const metadata = { title: "Find orders · Dart" };

export default function RunPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Run />
    </Suspense>
  );
}

async function Run() {
  const { supabase, userId, profile } = await getMember();
  await runMaintenance();

  const [{ data: open }, { data: mine }, { data: loads }] = await Promise.all([
    supabase
      .from("requests")
      .select("*")
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .neq("requester_id", userId)
      .order("expires_at", { ascending: true })
      .limit(100)
      .returns<DartRequest[]>(),
    supabase
      .from("requests")
      .select("*")
      .eq("runner_id", userId)
      .in("status", ["claimed", "purchased", "delivering", "dropped_off"])
      .returns<DartRequest[]>(),
    supabase.from("card_loads").select("amount_cents").eq("runner_id", userId).eq("status", "loaded").returns<Pick<CardLoad, "amount_cents">[]>(),
  ]);
  const ready = isRunnerReady(profile);
  const budgetCents = runnerBudgetCents(profile);
  const loadedCents = (loads ?? []).reduce((sum, l) => sum + l.amount_cents, 0);
  // "Delivering to" starts on the runner's own dorm, when it's in the launch area.
  const homeZones = profile.dorm && LAUNCH_ZONES.includes(profile.dorm) ? [profile.dorm] : [];

  return (
    <div className="px-4 pt-5">
      <RealtimeRefresh channel={`feed-${userId}`} />
      <h1 className="text-2xl font-extrabold tracking-tight">Going to the store?</h1>
      <p className="mt-1 text-muted">
        Pick up orders on a trip you&apos;re already making, before you leave or once you&apos;re there. Earn{" "}
        {money(FEES.runnerFeeCents)} each.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Timer className="size-4 text-action" /> {DELIVERY_WINDOW_MINUTES} min to buy and deliver, counted from when you claim.
      </p>

      {profile.status !== "active" ? (
        <Notice tone="warn" className="mt-4">
          Your account is {profile.status}. You can&apos;t claim orders right now.
        </Notice>
      ) : !ready ? (
        <Link href="/run/setup" className="mt-5 block">
          <Card className="flex items-center gap-3.5 border-action/20 bg-action-soft p-4">
            <BadgeCheck className="size-7 shrink-0 text-action" />
            <div className="flex-1">
              <p className="font-bold text-action-ink">Set up to run · 2 min</p>
              <p className="text-sm text-action-ink/80">Learn how the Dart card works, verify your ID and get your card.</p>
            </div>
            <ArrowRight className="size-5 text-action" />
          </Card>
        </Link>
      ) : (
        <RunnerBudget budgetCents={budgetCents} loadedCents={loadedCents} />
      )}

      {mine && mine.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted">Your current run</p>
          {mine.map((r) => (
            <RequestRow key={r.id} req={r} as="runner" />
          ))}
        </div>
      ) : null}

      <Feed requests={open ?? []} homeZones={homeZones} budgetLeftCents={ready ? Math.max(0, budgetCents - loadedCents) : null} />
    </div>
  );
}
