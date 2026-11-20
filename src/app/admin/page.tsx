import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { StatusPill, storeLabel } from "@/components/order-bits";
import { Card, PageSkeleton } from "@/components/ui";
import { getMember } from "@/lib/auth";
import { owesRunner } from "@/lib/pay";
import { displayName, money, shortDate } from "@/lib/format";
import { runMaintenance } from "@/lib/orders";
import { admin } from "@/lib/supabase/admin";
import { signedPhotoUrl } from "@/lib/storage";
import type { DartRequest, Dispute, Profile } from "@/lib/types";
import { DisputeResolver, MaintenanceButton, UserControls } from "./controls";

export const metadata = { title: "Team dashboard · Dart" };

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-lime-25">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/wishlist">
            <Logo size={26} />
          </Link>
          <span className="text-sm font-bold text-muted">Team dashboard</span>
        </div>
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

function daysAgo(n: number) {
  return Date.now() - n * 86400_000;
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function Dashboard() {
  const { profile } = await getMember();
  if (!profile.is_admin) redirect("/wishlist");
  await runMaintenance();

  const db = admin();
  const [
    { data: reqData },
    { data: profData },
    { data: disputeData },
    { data: notes },
    { data: timeouts },
  ] = await Promise.all([
    db.from("requests").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("disputes").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("notifications").select("*").order("created_at", { ascending: false }).limit(40),
    db.from("delivery_timeouts").select("stage, runner_id"),
  ]);
  const unboughtTimeouts = (timeouts ?? []).filter((t) => t.stage === "before_purchase").length;
  const lateTimeouts = (timeouts ?? []).filter((t) => t.stage === "after_purchase").length;
  const totalTimeouts = unboughtTimeouts + lateTimeouts;
  const runnersTimedOut = new Set((timeouts ?? []).map((t) => t.runner_id)).size;
  const requests = (reqData ?? []) as DartRequest[];
  const profiles = (profData ?? []) as Profile[];
  const disputes = (disputeData ?? []) as Dispute[];
  const names = new Map(profiles.map((p) => [p.id, displayName(p.full_name ?? p.email)]));

  // --- The MVP question: do requesters post, and do runners claim at $x? ---
  const decided = requests.filter((r) => r.status !== "open");
  const everClaimed = requests.filter((r) => r.claimed_at || r.runner_id);
  const claimRate = decided.length ? everClaimed.filter((r) => r.status !== "open").length / decided.length : null;
  const minsToClaim = everClaimed
    .filter((r) => r.claimed_at)
    .map((r) => (new Date(r.claimed_at!).getTime() - new Date(r.created_at).getTime()) / 60000);
  const completed = requests.filter((r) => r.status === "completed");
  const expired = requests.filter((r) => r.status === "expired");
  const cancelled = requests.filter((r) => r.status === "cancelled");
  const byRequester = new Map<string, number>();
  for (const r of requests) byRequester.set(r.requester_id, (byRequester.get(r.requester_id) ?? 0) + 1);
  const byRunner = new Map<string, number>();
  for (const r of completed) if (r.runner_id) byRunner.set(r.runner_id, (byRunner.get(r.runner_id) ?? 0) + 1);
  const weekAgo = daysAgo(7);

  const owed = requests.filter(owesRunner);
  const fees = completed.map((r) => r.runner_fee_cents);
  const paidBy = (m: string) => completed.filter((r) => r.paid_method === m).length;

  const unclaimed = requests.filter((r) => r.status === "open" && new Date(r.expires_at) > new Date());
  const inProgress = requests.filter((r) => ["claimed", "purchased", "delivering", "dropped_off"].includes(r.status));
  const openDisputes = disputes.filter((d) => d.status === "open");
  const reqById = new Map(requests.map((r) => [r.id, r]));
  // A timed-out claim resets the order, so claims = orders claimed now + times a claim ran out.
  const claimCount = everClaimed.length + unboughtTimeouts;
  const disputePhotos = await Promise.all(
    openDisputes.map(async (d) => {
      const r = reqById.get(d.request_id);
      return { items: await signedPhotoUrl(r?.items_photo_path ?? null), dropoff: await signedPhotoUrl(r?.dropoff_photo_path ?? null) };
    }),
  );

  const kpis: [string, string, string?][] = [
    ["Requests posted", String(requests.length), `${requests.filter((r) => new Date(r.created_at).getTime() > weekAgo).length} this week`],
    ["Claim rate", claimRate == null ? "—" : `${Math.round(claimRate * 100)}%`, `${everClaimed.length} claimed · ${expired.length} expired`],
    ["Median time to claim", minsToClaim.length ? `${Math.round(median(minsToClaim)!)} min` : "—"],
    ["Completed", String(completed.length), `${cancelled.length} cancelled`],
    [
      "Ran out of time",
      claimCount ? `${Math.round((totalTimeouts / claimCount) * 100)}%` : "—",
      `${unboughtTimeouts} not bought · ${lateTimeouts} bought, late · ${runnersTimedOut} runner${runnersTimedOut === 1 ? "" : "s"}`,
    ],
    ["Requesters", String(byRequester.size), `${[...byRequester.values()].filter((n) => n > 1).length} came back`],
    ["Runners", String(byRunner.size), `${[...byRunner.values()].filter((n) => n > 1).length} ran 2+ times`],
    ["Avg runner fee", fees.length ? money(Math.round(fees.reduce((a, b) => a + b, 0) / fees.length)) : "—", `${paidBy("venmo")} Venmo · ${paidBy("zelle")} Zelle`],
    ["Owed to runners", money(owed.reduce((a, r) => a + (r.charged_cents ?? 0), 0)), `${owed.length} order${owed.length === 1 ? "" : "s"} not paid back yet`],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Pilot</h1>
          <MaintenanceButton />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {kpis.map(([label, value, sub]) => (
            <Card key={label} className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
              {sub ? <p className="text-xs text-muted">{sub}</p> : null}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Unclaimed now · backup runner</h2>
        <OrderTable rows={unclaimed} names={names} empty="Nothing waiting. 🎉" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">In progress</h2>
        <OrderTable rows={inProgress} names={names} empty="No active orders." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Reports: unpaid &amp; problems</h2>
        {openDisputes.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openDisputes.map((d, i) => {
              const r = reqById.get(d.request_id);
              if (!r) return null;
              return (
                <Card key={d.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{d.reason}</p>
                      <p className="text-sm text-muted">
                        {names.get(r.requester_id)} vs runner {r.runner_id ? names.get(r.runner_id) : "—"} · {shortDate(d.created_at)}
                      </p>
                    </div>
                    <Link href={`/orders/${r.id}`} className="text-sm font-semibold text-action">
                      Order
                    </Link>
                  </div>
                  <p className="text-sm">{r.items}</p>
                  {d.details ? <p className="rounded-xl bg-lime-25 p-3 text-sm text-muted">&ldquo;{d.details}&rdquo;</p> : null}
                  <p className="text-xs text-muted">
                    {d.kind === "unpaid" ? "Runner says they weren't paid · " : ""}
                    Owed {money(r.charged_cents)} · receipt {money(r.purchase_cents)} · fee {money(r.runner_fee_cents)}
                    {r.paid_reported_at ? ` · requester says paid on ${r.paid_method}` : " · requester hasn't said they paid"}
                  </p>
                  <div className="flex gap-2">
                    {[disputePhotos[i].items, disputePhotos[i].dropoff].map((src, j) =>
                      // eslint-disable-next-line @next/next/no-img-element
                      src ? <img key={j} src={src} alt="" className="h-28 w-28 rounded-xl object-cover" /> : null,
                    )}
                  </div>
                  <DisputeResolver disputeId={d.id} unpaid={d.kind === "unpaid"} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Users</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Dorm</th>
                <th className="p-3">Runner</th>
                <th className="p-3">Venmo / Zelle</th>
                <th className="p-3">No-shows</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <p className="font-semibold">{p.full_name ?? "—"}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </td>
                  <td className="p-3">{p.dorm ?? "—"}</td>
                  <td className="p-3">{p.runner_terms_accepted_at ? "Yes" : "—"}</td>
                  <td className="p-3 text-xs">{[p.venmo_username && `@${p.venmo_username}`, p.zelle_contact].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-3">{p.no_show_count}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">{p.is_admin ? <span className="text-xs text-muted">admin</span> : <UserControls userId={p.id} status={p.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-extrabold">Texts &amp; pushes</h2>
        <p className="mb-3 text-sm text-muted">&ldquo;Logged&rdquo; means the provider isn&apos;t configured yet (Twilio pending 10DLC, or no VAPID keys).</p>
        <Card className="divide-y divide-line">
          {(notes ?? []).length === 0 ? <p className="p-4 text-sm text-muted">Nothing yet.</p> : null}
          {(notes ?? []).map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-3 text-sm">
              <span className="w-12 shrink-0 text-xs font-bold uppercase text-muted">{n.channel}</span>
              <span className="flex-1">
                <span className="font-semibold">{names.get(n.user_id)}:</span> {n.body}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {n.delivered ? "sent" : "logged"} · {shortDate(n.created_at)}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function OrderTable({ rows, names, empty }: { rows: DartRequest[]; names: Map<string, string>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <Card className="divide-y divide-line">
      {rows.map((r) => (
        <Link key={r.id} href={`/orders/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm hover:bg-lime-25">
          <StatusPill status={r.status} as="requester" />
          {r.deliver_by && ["claimed", "purchased", "delivering"].includes(r.status) && new Date(r.deliver_by) <= new Date() ? (
            <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">Past 45 min</span>
          ) : null}
          <span className="min-w-0 flex-1 truncate font-semibold">{r.items}</span>
          <span className="text-muted">{storeLabel(r.store)} → {r.dropoff_zone}</span>
          <span className="text-muted">
            {names.get(r.requester_id)}
            {r.runner_id ? ` → ${names.get(r.runner_id)}` : ""}
          </span>
          <span className="tabular-nums text-muted">≤{money(r.max_price_cents)}</span>
          <span className="text-xs text-muted">{r.status === "open" ? `closes ${shortDate(r.expires_at)}` : shortDate(r.created_at)}</span>
        </Link>
      ))}
    </Card>
  );
}
