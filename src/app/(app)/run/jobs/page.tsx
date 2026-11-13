import { Suspense } from "react";
import { Bike } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequestRow } from "@/components/request-row";
import { ButtonLink, Card, EmptyState, PageSkeleton, SectionTitle } from "@/components/ui";
import { getMember } from "@/lib/auth";
import { money } from "@/lib/format";
import { ratingFor, runMaintenance } from "@/lib/orders";
import type { DartRequest } from "@/lib/types";

export const metadata = { title: "My runs · Dart" };

const ACTIVE = ["claimed", "purchased", "delivering", "dropped_off", "disputed"];

export default function JobsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Jobs />
    </Suspense>
  );
}

async function Jobs() {
  const { supabase, userId } = await getMember();
  await runMaintenance();
  const [{ data }, rating] = await Promise.all([
    supabase
      .from("requests")
      .select("*")
      .eq("runner_id", userId)
      .order("claimed_at", { ascending: false })
      .limit(100)
      .returns<DartRequest[]>(),
    ratingFor(userId),
  ]);
  const runs = data ?? [];
  const active = runs.filter((r) => ACTIVE.includes(r.status));
  const past = runs.filter((r) => !ACTIVE.includes(r.status));
  const earned = runs.filter((r) => r.payout_status === "released").reduce((s, r) => s + r.runner_fee_cents, 0);
  const pending = runs.filter((r) => r.payout_status === "pending").reduce((s, r) => s + r.runner_fee_cents, 0);
  const completed = runs.filter((r) => r.status === "completed").length;

  return (
    <div className="px-4 pt-5">
      <RealtimeRefresh channel={`jobs-${userId}`} filter={`runner_id=eq.${userId}`} />
      <h1 className="text-2xl font-extrabold tracking-tight">My runs</h1>

      <Card className="mt-5 grid grid-cols-3 divide-x divide-line bg-lime-50/60 py-4 text-center">
        <Stat label="Earned" value={money(earned)} />
        <Stat label="Pending" value={money(pending)} />
        <Stat label="Rating" value={rating.avg ? `${rating.avg.toFixed(1)}★` : "—"} sub={`${completed} done`} />
      </Card>

      {runs.length === 0 ? (
        <EmptyState icon={<Bike className="size-7" />} title="No runs yet">
          <p>Claim an order that fits a trip you&apos;re already making.</p>
          <ButtonLink href="/run" className="mt-5">
            Find orders
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          {active.length > 0 ? (
            <>
              <SectionTitle>Active</SectionTitle>
              <div className="space-y-3">
                {active.map((r) => (
                  <RequestRow key={r.id} req={r} as="runner" />
                ))}
              </div>
            </>
          ) : null}
          {past.length > 0 ? (
            <>
              <SectionTitle>Past</SectionTitle>
              <div className="space-y-3">
                {past.map((r) => (
                  <RequestRow key={r.id} req={r} as="runner" />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-muted">{sub ?? label}</p>
    </div>
  );
}
