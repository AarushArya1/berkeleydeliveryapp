import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequestRow } from "@/components/request-row";
import { Card, Notice, PageSkeleton } from "@/components/ui";
import { getMember, isRunnerReady } from "@/lib/auth";
import { DELIVERY_WINDOW_MINUTES, FEES } from "@/lib/config";
import { money } from "@/lib/format";
import { runMaintenance } from "@/lib/orders";
import type { DartRequest } from "@/lib/types";
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

  const [{ data: open }, { data: mine }] = await Promise.all([
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
  ]);

  return (
    <div className="px-4 pt-5">
      <RealtimeRefresh channel={`feed-${userId}`} />
      <h1 className="text-2xl font-extrabold tracking-tight">Heading out?</h1>
      <p className="mt-1 text-muted">
        Grab an order on the way. Earn {money(FEES.runnerFeeCents)} each, with {DELIVERY_WINDOW_MINUTES} min to deliver once you claim.
      </p>

      {profile.status !== "active" ? (
        <Notice tone="warn" className="mt-4">
          Your account is {profile.status}. You can&apos;t claim orders right now.
        </Notice>
      ) : !isRunnerReady(profile) ? (
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
      ) : null}

      {mine && mine.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted">Your current run</p>
          {mine.map((r) => (
            <RequestRow key={r.id} req={r} as="runner" />
          ))}
        </div>
      ) : null}

      <Feed requests={open ?? []} />
    </div>
  );
}
