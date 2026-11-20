import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { PageSkeleton } from "@/components/ui";
import { getMember, isRunnerReady } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { signedPhotoUrl } from "@/lib/storage";
import { ratingFor, runMaintenance } from "@/lib/orders";
import { displayName } from "@/lib/format";
import { DISPUTE_WINDOW_HOURS, runnerBudgetCents } from "@/lib/config";
import { payMethods } from "@/lib/pay";
import type { DartRequest, Dispute } from "@/lib/types";
import { RequesterView } from "./requester-view";
import { RunnerView } from "./runner-view";
import { ProspectView } from "./prospect-view";

export const metadata = { title: "Order · Dart" };

function canDispute(req: DartRequest) {
  if (["claimed", "delivering", "dropped_off"].includes(req.status)) return true;
  return req.status === "completed" && Boolean(req.completed_at) && Date.now() - new Date(req.completed_at!).getTime() < DISPUTE_WINDOW_HOURS * 3600_000;
}

export type Counterpart = {
  name: string;
  rating: number | null;
  ratingCount: number;
  /** Their Venmo / Zelle: the runner's for the requester to pay, the requester's so the runner knows what to expect. */
  venmo: string | null;
  zelle: string | null;
} | null;

export default function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Order({ params, searchParams }: Pick<PageProps<"/orders/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const posted = (await searchParams).posted === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase, userId, profile } = await getMember();
  await runMaintenance();

  // Row Level Security decides whether this viewer may see the order at all.
  const { data: req } = await supabase.from("requests").select("*").eq("id", id).maybeSingle<DartRequest>();
  if (!req) notFound();

  const isRequester = req.requester_id === userId;
  const isRunner = req.runner_id === userId;

  if (!isRequester && !isRunner) {
    const { data: requester } = await admin().from("profiles").select("venmo_username, zelle_contact").eq("id", req.requester_id).single();
    return (
      <>
        <RealtimeRefresh channel={`order-${id}`} filter={`id=eq.${id}`} />
        <ProspectView
          req={req}
          ready={isRunnerReady(profile)}
          active={profile.status === "active"}
          budgetCents={runnerBudgetCents(profile)}
          requesterMethods={requester ? payMethods(requester) : []}
          myMethods={payMethods(profile)}
        />
      </>
    );
  }

  const counterpartId = isRequester ? req.runner_id : req.requester_id;
  const db = admin();
  const [{ data: priv }, { data: codeRow }, counterpartProfile, counterpartRating, receiptPhoto, itemsPhoto, dropoffPhoto, { data: dispute }, { data: myRating }] =
    await Promise.all([
      supabase.from("request_private").select("dropoff_spot").eq("request_id", id).maybeSingle(),
      // Only the requester can read their handoff code (RLS).
      isRequester ? supabase.from("request_codes").select("code").eq("request_id", id).maybeSingle() : Promise.resolve({ data: null }),
      counterpartId
        ? db.from("profiles").select("full_name, venmo_username, zelle_contact").eq("id", counterpartId).single()
        : Promise.resolve({ data: null }),
      counterpartId ? ratingFor(counterpartId) : Promise.resolve(null),
      signedPhotoUrl(req.receipt_photo_path),
      signedPhotoUrl(req.items_photo_path),
      signedPhotoUrl(req.dropoff_photo_path),
      supabase.from("disputes").select("*").eq("request_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle<Dispute>(),
      supabase.from("ratings").select("stars").eq("request_id", id).eq("rater_id", userId).maybeSingle(),
    ]);

  const counterpart: Counterpart =
    counterpartId && counterpartProfile.data
      ? {
          name: displayName(counterpartProfile.data.full_name),
          rating: counterpartRating?.avg ?? null,
          ratingCount: counterpartRating?.count ?? 0,
          venmo: counterpartProfile.data.venmo_username,
          zelle: counterpartProfile.data.zelle_contact,
        }
      : null;

  const shared = {
    req,
    spot: priv?.dropoff_spot ?? null,
    counterpart,
    receiptPhoto,
    itemsPhoto,
    dropoffPhoto,
    dispute: dispute ?? null,
    myRating: myRating?.stars ?? null,
  };

  if (isRequester) {
    return (
      <>
        <RealtimeRefresh channel={`order-${id}`} filter={`id=eq.${id}`} />
        <RequesterView {...shared} code={codeRow?.code ?? null} posted={posted} canDispute={canDispute(req)} />
      </>
    );
  }

  return (
    <>
      <RealtimeRefresh channel={`order-${id}`} filter={`id=eq.${id}`} />
      <RunnerView {...shared} />
    </>
  );
}
