import "server-only";
import { admin } from "./supabase/admin";
import { payments } from "./payments";
import { decideAuthorization, type AuthorizationDecision, type OpenLoad } from "./payments/authorize";
import { breakdown, reserveShareCents } from "./fees";
import {
  ARM_MINUTES,
  DELIVERY_WARNING_MINUTES,
  DELIVERY_WINDOW_MINUTES,
  DISPUTE_WINDOW_HOURS,
  DURATIONS,
  ETA_OPTIONS,
  FALLBACK_RELEASE_HOURS,
  FEES,
  LAUNCH_ZONES,
  LIMITS,
  MAX_CODE_ATTEMPTS,
  NO_SHOW_BAN_THRESHOLD,
  TRUST_TIERS,
  TRUST_TIERS_ENABLED,
  TRUST_TIER_MIN_RATING,
  findRestricted,
  getStore,
  runnerBudgetCents,
} from "./config";
import { clockTime, displayName, money } from "./format";
import { inBackground } from "./background";
import { orderUrl, sendPush, sendSms } from "./notify";
import { uploadPhoto, validatePhoto } from "./storage";
import { isOnboarded, isRunnerReady } from "./auth";
import type { ActionResult, Card, CardLoad, DartRequest, Profile, RequestStatus } from "./types";

// The order state machine. Every function here is called from a server action
// with an already-verified user id, re-checks permissions itself, and changes
// status with a conditional update (`.eq("status", ...)`) so two people acting
// at once can't both win.

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function getProfile(id: string) {
  const { data } = await admin().from("profiles").select("*").eq("id", id).single<Profile>();
  return data;
}

async function getRequest(id: string) {
  const { data } = await admin().from("requests").select("*").eq("id", id).maybeSingle<DartRequest>();
  return data;
}

/** Conditional status change. Returns the updated row, or null if the order moved on. */
async function transition(id: string, from: RequestStatus | RequestStatus[], patch: Partial<DartRequest>) {
  const q = admin().from("requests").update(patch).eq("id", id);
  const { data, error } = await (Array.isArray(from) ? q.in("status", from) : q.eq("status", from))
    .select("*")
    .maybeSingle<DartRequest>();
  if (error) throw new Error(error.message);
  return data;
}

function shortItems(items: string) {
  const one = items.replace(/\s+/g, " ").trim();
  return one.length > 40 ? `${one.slice(0, 38)}…` : one;
}

function notifyPush(userId: string | null, title: string, body: string, req: { id: string }) {
  if (!userId) return;
  inBackground(() => sendPush(userId, { title, body, url: orderUrl(req.id) }, req.id));
}

function requireActive(p: Profile | null): string | null {
  if (!p) return "Account not found";
  if (p.status === "banned") return "Your account has been banned";
  if (p.status === "suspended") return "Your account is suspended pending review";
  if (!isOnboarded(p)) return "Finish signing up first";
  return null;
}

// ---------------------------------------------------------------------------
// Requester: post
// ---------------------------------------------------------------------------

export type NewRequestInput = {
  items: string;
  notes: string;
  store: string;
  zone: string;
  spot: string;
  maxPriceCents: number;
  durationHours: number;
  restrictedAck: boolean;
};

export async function createRequest(userId: string, input: NewRequestInput): Promise<ActionResult<{ id: string }>> {
  const profile = await getProfile(userId);
  const blocked = requireActive(profile);
  if (blocked) return fail(blocked);

  const items = input.items.trim();
  const notes = input.notes.trim();
  const spot = input.spot.trim();
  if (items.length < 3) return fail("Tell runners what to buy");
  if (items.length > 500) return fail("Keep the item list under 500 characters");
  if (notes.length > 300) return fail("Keep notes under 300 characters");
  const restricted = findRestricted(`${items}\n${notes}`);
  if (restricted) return fail(`"${restricted}" can't be requested. Alcohol, tobacco, vapes, prescription drugs and age-restricted items aren't allowed.`);
  if (!input.restrictedAck) return fail("Confirm there are no restricted items");
  if (!getStore(input.store)) return fail("Pick a store");
  if (!LAUNCH_ZONES.includes(input.zone)) return fail("Pick a drop-off area");
  if (spot.length < 2 || spot.length > 120) return fail("Add a drop-off spot (building and where to meet)");
  const max = input.maxPriceCents;
  if (!Number.isInteger(max) || max < LIMITS.minOrderCents) return fail(`Orders must be at least ${money(LIMITS.minOrderCents)} in items`);
  if (max > LIMITS.launchMaxCents) return fail(`Max price is capped at ${money(LIMITS.launchMaxCents)} during launch`);
  if (!DURATIONS.some((d) => d.hours === input.durationHours)) return fail("Pick how long the request stays open");

  const b = breakdown(max);
  const db = admin();
  const { data: req, error } = await db
    .from("requests")
    .insert({
      requester_id: userId,
      items,
      notes: notes || null,
      store: input.store,
      dropoff_zone: input.zone,
      max_price_cents: max,
      runner_fee_cents: FEES.runnerFeeCents,
      dart_fee_cents: FEES.dartFeeCents,
      hold_cents: b.totalCents,
      expires_at: new Date(Date.now() + input.durationHours * 3600_000).toISOString(),
    })
    .select("*")
    .single<DartRequest>();
  if (error || !req) return fail("Couldn't post your request. Try again.");

  await db.from("request_private").insert({ request_id: req.id, dropoff_spot: spot });
  await payments.placeHold(req);
  await db.from("profiles").update({ default_spot: spot }).eq("id", userId);

  return { ok: true, data: { id: req.id } };
}

// ---------------------------------------------------------------------------
// Runner: claim / release
// ---------------------------------------------------------------------------

export async function runnerOrderLimit(runnerId: string) {
  if (!TRUST_TIERS_ENABLED) return LIMITS.launchMaxCents;
  const db = admin();
  const { count } = await db
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("runner_id", runnerId)
    .eq("status", "completed");
  const { avg } = await ratingFor(runnerId);
  const completed = count ?? 0;
  let limit = TRUST_TIERS[0].maxCents;
  for (const tier of TRUST_TIERS) {
    if (completed >= tier.minCompleted && (tier.minCompleted === 0 || (avg ?? 0) >= TRUST_TIER_MIN_RATING)) limit = tier.maxCents;
  }
  return limit;
}

export async function claimRequest(runnerId: string, requestId: string, etaMinutes: number): Promise<ActionResult> {
  const runner = await getProfile(runnerId);
  const blocked = requireActive(runner);
  if (blocked) return fail(blocked);
  if (!isRunnerReady(runner!)) return fail("Finish runner setup before claiming");
  if (!ETA_OPTIONS.some((o) => o.minutes === etaMinutes)) return fail("Pick when you'll arrive");

  const req = await getRequest(requestId);
  if (!req || req.status !== "open" || new Date(req.expires_at) <= new Date()) return fail("This request is no longer open");
  if (req.requester_id === runnerId) return fail("You can't claim your own request");
  if (req.max_price_cents > (await runnerOrderLimit(runnerId))) return fail("This order is above your current limit");

  const db = admin();
  // One Dart card per runner; each claimed order gets its own load on it.
  const { data: card } = await db.from("cards").select("*").eq("runner_id", runnerId).maybeSingle<Card>();
  if (!card) return fail("Create your Dart card in runner setup first");
  if (card.status === "frozen") return fail("Your Dart card is frozen. Contact the Dart team.");

  // The runner's own cap on how much can be on their card at once.
  const { data: onCard } = await db.from("card_loads").select("amount_cents").eq("card_id", card.id).eq("status", "loaded");
  const loadedCents = (onCard ?? []).reduce((sum, l) => sum + l.amount_cents, 0);
  const budget = runnerBudgetCents(runner!);
  if (loadedCents + req.max_price_cents > budget) {
    return fail(
      `This order could cost up to ${money(req.max_price_cents)}, which would put you over your ${money(budget)} budget (${money(Math.max(0, budget - loadedCents))} left). Raise your budget on the Run tab to claim it.`,
    );
  }

  const now = Date.now();
  const eta = new Date(now + etaMinutes * 60_000).toISOString();
  const deliverBy = new Date(now + DELIVERY_WINDOW_MINUTES * 60_000).toISOString();
  const { data: claimed, error } = await db
    .from("requests")
    .update({
      status: "claimed",
      runner_id: runnerId,
      claimed_at: new Date(now).toISOString(),
      eta_at: eta,
      deliver_by: deliverBy,
      deliver_warned_at: null,
      overdue_notified_at: null,
    })
    .eq("id", requestId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle<DartRequest>();
  if (error || !claimed) return fail("Someone else just claimed this one");

  // Add this order to the runner's card: its max price, its store, one purchase.
  await payments.loadCard(card, claimed);

  const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  await db.from("request_codes").upsert({ request_id: requestId, code, attempts: 0 });

  const who = displayName(runner!.full_name);
  inBackground(() =>
    sendSms(
      claimed.requester_id,
      `Dart: ${who} claimed your request (${shortItems(claimed.items)}) and expects to arrive around ${clockTime(eta)}. Your handoff code is in the app.`,
      claimed.id,
    ),
  );
  notifyPush(claimed.requester_id, `${who} claimed your order`, `Arriving around ${clockTime(eta)}. Open Dart for your handoff code.`, claimed);
  return { ok: true };
}

/** Runner backs out before buying anything. The request goes back on the shopping list. */
export async function releaseClaim(runnerId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || req.status !== "claimed") return fail("You can only release an order before buying it");
  return unclaim(req, "released");
}

/** Put a claimed (not yet bought) order back on the shopping list, or close it if its window is over. */
async function unclaim(req: DartRequest, why: "released" | "timed_out"): Promise<ActionResult> {
  const stillOpen = new Date(req.expires_at) > new Date();
  const reset = { runner_id: null, claimed_at: null, eta_at: null, deliver_by: null, deliver_warned_at: null };
  const updated = await admin()
    .from("requests")
    .update(stillOpen ? { status: "open", ...reset } : { status: "expired", ...reset })
    .eq("id", req.id)
    .eq("status", "claimed")
    .eq("runner_id", req.runner_id!)
    .select("*")
    .maybeSingle<DartRequest>();
  if (!updated.data) return fail("This order already changed");

  await admin().from("request_codes").delete().eq("request_id", req.id);
  await payments.unloadCard(req.id, why);
  if (!stillOpen) await payments.releaseHold(req, why === "timed_out" ? "expired after runner timed out" : "expired after runner released");

  if (why === "timed_out") {
    await admin().from("delivery_timeouts").insert({ request_id: req.id, runner_id: req.runner_id, stage: "before_purchase" });
    notifyPush(
      req.runner_id,
      "Time's up — order released",
      `You didn't buy "${shortItems(req.items)}" within ${DELIVERY_WINDOW_MINUTES} minutes of claiming it, so it went back on the shopping list and it was taken off your Dart card.`,
      req,
    );
  }
  notifyPush(
    req.requester_id,
    why === "timed_out" ? "Your runner ran out of time" : "Your runner can't make it",
    stillOpen ? "Your request is back on the shopping list." : "Your request closed. You weren't charged.",
    req,
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Runner: pay with the Dart card (simulated tap), photo, handoff
// ---------------------------------------------------------------------------

/**
 * PAYMENTS PLACEHOLDER: stands in for the runner tapping their Dart card at
 * checkout. Like a real tap, it only knows the store and the amount; the same
 * approve/decline rule Stripe Issuing will call decides which order it pays for.
 */
export async function simulateCardTap(
  runnerId: string,
  amountCents: number,
  merchantStoreId: string,
): Promise<ActionResult<AuthorizationDecision>> {
  const db = admin();
  const { data: card } = await db.from("cards").select("*").eq("runner_id", runnerId).maybeSingle<Card>();
  if (!card) return fail("You don't have a Dart card yet");
  const loads = await openLoads(card.id);
  const merchant = getStore(merchantStoreId);
  const merchantCategory = merchant?.category ?? "restaurants";

  let decision = decideAuthorization({ card, loads, amountCents, merchantStoreId, merchantCategory });

  let purchased: DartRequest | null = null;
  if (decision.approved) {
    const req = loads.find((l) => l.load.id === (decision as { loadId: string }).loadId)!.request!;
    const b = breakdown(amountCents, req.runner_fee_cents, req.dart_fee_cents);
    purchased = await transition(req.id, "claimed", {
      status: "purchased",
      purchase_cents: amountCents,
      purchase_merchant: merchant?.name ?? "Other merchant",
      processing_cents: b.processingCents,
      charged_cents: Math.min(b.totalCents, req.hold_cents),
      purchased_at: new Date().toISOString(),
      payout_status: "pending",
    });
    if (!purchased) decision = { approved: false, reason: "Order is not active", loadId: decision.loadId, requestId: decision.requestId };
  }

  await db.from("card_authorizations").insert({
    card_id: card.id,
    card_load_id: decision.loadId,
    runner_id: runnerId,
    request_id: decision.requestId,
    amount_cents: Number.isFinite(amountCents) ? amountCents : 0,
    merchant: merchant?.name ?? "Other merchant",
    merchant_category: merchantCategory,
    approved: decision.approved,
    decline_reason: decision.approved ? null : decision.reason,
  });

  if (purchased) {
    // Charge at purchase: exact amount + fees from the hold; the rest is released.
    await payments.capture(purchased, purchased.charged_cents!);
    await payments.reserveContribution(purchased, reserveShareCents(purchased.dart_fee_cents));
    // One purchase per load: this order comes off the card right away.
    await payments.unloadCard(purchased.id, "purchased");
    notifyPush(
      purchased.requester_id,
      "Your items were bought",
      `${money(purchased.purchase_cents)} at ${purchased.purchase_merchant}. You were charged ${money(purchased.charged_cents)} total.`,
      purchased,
    );
  }
  return { ok: true, data: decision };
}

/** The card's open loads with their orders, newest first. */
export async function openLoads(cardId: string): Promise<OpenLoad[]> {
  const db = admin();
  const { data: loads } = await db
    .from("card_loads")
    .select("*")
    .eq("card_id", cardId)
    .eq("status", "loaded")
    .order("loaded_at", { ascending: false })
    .returns<CardLoad[]>();
  if (!loads?.length) return [];
  const { data: reqs } = await db.from("requests").select("*").in("id", loads.map((l) => l.request_id)).returns<DartRequest[]>();
  return loads.map((load) => ({ load, request: reqs?.find((r) => r.id === load.request_id) ?? null }));
}

/**
 * Two orders at the same store: the runner marks which one the next tap is
 * for. Lasts long enough to get through checkout.
 */
export async function armLoad(runnerId: string, requestId: string): Promise<ActionResult> {
  const db = admin();
  const { data: load } = await db
    .from("card_loads")
    .select("id")
    .eq("runner_id", runnerId)
    .eq("request_id", requestId)
    .eq("status", "loaded")
    .maybeSingle();
  if (!load) return fail("This order isn't on your Dart card");
  await db.from("card_loads").update({ armed_until: null }).eq("runner_id", runnerId).eq("status", "loaded");
  await db
    .from("card_loads")
    .update({ armed_until: new Date(Date.now() + ARM_MINUTES * 60_000).toISOString() })
    .eq("id", load.id);
  return { ok: true };
}

export async function markPurchased(runnerId: string, requestId: string, photo: unknown): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || req.status !== "purchased") return fail("Pay with your Dart card first");
  if (!validatePhoto(photo)) return fail("Add a photo of the items and receipt (under 8 MB)");

  const path = await uploadPhoto(requestId, "items", photo);
  const updated = await transition(requestId, "purchased", {
    status: "delivering",
    items_photo_path: path,
    picked_up_at: new Date().toISOString(),
  });
  if (!updated) return fail("This order already changed");
  notifyPush(req.requester_id, "Your order is on the way", "Have your 4-digit code ready at the drop-off spot.", req);
  return { ok: true };
}

export async function completeWithCode(runnerId: string, requestId: string, code: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || !["delivering", "dropped_off"].includes(req.status)) return fail("This order isn't ready for handoff");

  const db = admin();
  const { data: row } = await db.from("request_codes").select("*").eq("request_id", requestId).single();
  if (!row) return fail("No code on this order");
  if (row.attempts >= MAX_CODE_ATTEMPTS) return fail("Too many wrong codes. Use the drop-off photo instead.");
  if (row.code !== code.trim()) {
    await db.from("request_codes").update({ attempts: row.attempts + 1 }).eq("request_id", requestId);
    const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
    return fail(left > 0 ? `That code didn't match. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Use the drop-off photo instead.");
  }
  return finishOrder(req, "code");
}

/** No-code fallback: drop-off photo, fee releases after 3 hours unless disputed. */
export async function submitDropoff(
  runnerId: string,
  requestId: string,
  photo: unknown,
  coords: { lat: number; lng: number } | null,
): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || req.status !== "delivering") return fail("This order isn't out for delivery");
  if (!validatePhoto(photo)) return fail("Add a photo of the items at the drop-off spot (under 8 MB)");

  const path = await uploadPhoto(requestId, "dropoff", photo);
  const releaseAt = new Date(Date.now() + FALLBACK_RELEASE_HOURS * 3600_000).toISOString();
  const updated = await transition(requestId, "delivering", {
    status: "dropped_off",
    dropoff_photo_path: path,
    dropoff_lat: coords?.lat ?? null,
    dropoff_lng: coords?.lng ?? null,
    dropped_off_at: new Date().toISOString(),
    auto_release_at: releaseAt,
  });
  if (!updated) return fail("This order already changed");
  notifyPush(
    req.requester_id,
    "Your order was left at the drop-off spot",
    `Your runner couldn't find you. If something's wrong, report it before ${clockTime(releaseAt)}.`,
    req,
  );
  return { ok: true };
}

/** Requester confirms they picked up a dropped-off order. */
export async function confirmReceived(requesterId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId || req.status !== "dropped_off") return fail("Nothing to confirm");
  return finishOrder(req, "confirmed");
}

async function finishOrder(req: DartRequest, method: "code" | "fallback" | "confirmed"): Promise<ActionResult> {
  const now = new Date().toISOString();
  const done = await transition(req.id, ["delivering", "dropped_off"], {
    status: "completed",
    completed_at: now,
    completion_method: method,
    payout_status: "released",
    payout_released_at: now,
  });
  if (!done) return fail("This order already changed");

  await payments.releasePayout(done, method === "code" ? "handoff code entered" : method === "confirmed" ? "requester confirmed drop-off" : "no-code fallback after 3 hours");

  if (method === "fallback") {
    const requester = await getProfile(done.requester_id);
    if (requester) {
      const count = requester.no_show_count + 1;
      await admin()
        .from("profiles")
        .update({ no_show_count: count, ...(count >= NO_SHOW_BAN_THRESHOLD && !requester.is_admin ? { status: "banned" } : {}) })
        .eq("id", requester.id);
    }
  }

  notifyPush(done.runner_id, `You earned ${money(done.runner_fee_cents)}`, "Paid out with your next daily payout (1–2 business days).", done);
  if (method !== "confirmed") notifyPush(done.requester_id, "Order delivered", "Thanks for using Dart! Rate your runner.", done);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cancellations (plan section 5)
// ---------------------------------------------------------------------------

export async function cancelRequest(requesterId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId) return fail("Request not found");
  const now = new Date().toISOString();

  if (req.status === "open") {
    const done = await transition(req.id, "open", { status: "cancelled", cancelled_at: now, cancelled_stage: "before_claim" });
    if (!done) return fail("This request just changed. Refresh and try again.");
    await payments.releaseHold(req, "cancelled before claim");
    return { ok: true };
  }

  if (req.status === "claimed") {
    const done = await transition(req.id, "claimed", { status: "cancelled", cancelled_at: now, cancelled_stage: "after_claim" });
    if (!done) return fail("Your runner just paid for the items. Refresh to see the update.");
    await payments.releaseHold(req, "cancelled after claim, before purchase");
    await payments.unloadCard(req.id, "cancelled");
    await admin().from("request_codes").delete().eq("request_id", req.id);
    notifyPush(req.runner_id, "Order cancelled", "The requester cancelled before you bought anything. It's been taken off your Dart card.", req);
    return { ok: true };
  }

  if (["purchased", "delivering", "dropped_off"].includes(req.status)) {
    const done = await transition(req.id, ["purchased", "delivering", "dropped_off"], {
      status: "cancelled",
      cancelled_at: now,
      cancelled_stage: "after_purchase",
      payout_status: "released",
      payout_released_at: now,
    });
    if (!done) return fail("This order just changed. Refresh and try again.");
    await payments.releasePayout(done, "requester cancelled after purchase");
    notifyPush(req.runner_id, `Order cancelled — you still earned ${money(req.runner_fee_cents)}`, "The requester cancelled after you bought the items. They've paid in full.", req);
    return { ok: true };
  }

  return fail("This order can't be cancelled");
}

// ---------------------------------------------------------------------------
// Disputes, ratings
// ---------------------------------------------------------------------------

export const DISPUTE_REASONS = ["Items damaged", "Items lost / never arrived", "Wrong items", "Other"] as const;

export async function openDispute(requesterId: string, requestId: string, reason: string, details: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId) return fail("Request not found");
  if (!(DISPUTE_REASONS as readonly string[]).includes(reason)) return fail("Pick what went wrong");
  const inProgress = ["purchased", "delivering", "dropped_off"].includes(req.status);
  const recentlyDone =
    req.status === "completed" && req.completed_at && Date.now() - new Date(req.completed_at).getTime() < DISPUTE_WINDOW_HOURS * 3600_000;
  if (!inProgress && !recentlyDone) return fail("This order can't be disputed");

  const updated = await transition(req.id, req.status, {
    status: "disputed",
    status_before_dispute: req.status,
    payout_status: req.payout_status === "pending" ? "withheld" : req.payout_status,
  });
  if (!updated) return fail("This order just changed. Refresh and try again.");

  const db = admin();
  await db.from("disputes").insert({ request_id: req.id, opened_by: requesterId, reason, details: details.trim().slice(0, 1000) || null });
  notifyPush(req.runner_id, "A problem was reported on your order", "The Dart team is reviewing it. Your fee is on hold until then.", req);

  const { data: admins } = await db.from("profiles").select("id").eq("is_admin", true);
  for (const a of admins ?? []) {
    inBackground(() => sendPush(a.id, { title: "New dispute", body: `${reason}: ${shortItems(req.items)}`, url: "/admin" }, req.id));
  }
  return { ok: true };
}

export async function rateCounterpart(userId: string, requestId: string, stars: number, comment: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.status !== "completed" || !req.runner_id) return fail("You can rate after the order is complete");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail("Pick 1 to 5 stars");
  const ratee = userId === req.requester_id ? req.runner_id : userId === req.runner_id ? req.requester_id : null;
  if (!ratee) return fail("Not your order");
  const { error } = await admin()
    .from("ratings")
    .insert({ request_id: requestId, rater_id: userId, ratee_id: ratee, stars, comment: comment.trim().slice(0, 300) || null });
  if (error) return fail(error.code === "23505" ? "You already rated this order" : "Couldn't save your rating");
  return { ok: true };
}

export async function ratingFor(userId: string) {
  const { data } = await admin().from("ratings").select("stars").eq("ratee_id", userId);
  const n = data?.length ?? 0;
  return { avg: n ? data!.reduce((s, r) => s + r.stars, 0) / n : null, count: n };
}

// ---------------------------------------------------------------------------
// Admin (Dart team)
// ---------------------------------------------------------------------------

async function requireAdmin(adminId: string) {
  const p = await getProfile(adminId);
  return Boolean(p?.is_admin);
}

export async function resolveDispute(
  adminId: string,
  disputeId: string,
  input: { outcome: "refund" | "reject"; refundCents: number; payRunner: boolean; suspendRunner: boolean; note: string },
): Promise<ActionResult> {
  if (!(await requireAdmin(adminId))) return fail("Admins only");
  const db = admin();
  const { data: dispute } = await db.from("disputes").select("*").eq("id", disputeId).single();
  if (!dispute || dispute.status !== "open") return fail("Dispute already resolved");
  const req = await getRequest(dispute.request_id);
  if (!req || req.status !== "disputed") return fail("Order is not in dispute");

  const now = new Date().toISOString();
  if (input.outcome === "refund") {
    const refund = Math.max(0, Math.min(input.refundCents, req.charged_cents ?? 0));
    const payNow = input.payRunner && req.payout_status === "withheld";
    await transition(req.id, "disputed", { status: "refunded", ...(payNow ? { payout_status: "released", payout_released_at: now } : {}) });
    if (refund > 0) await payments.refund(req, refund, dispute.reason);
    if (payNow) await payments.releasePayout(req, "dispute resolved: runner paid");
    if (input.suspendRunner && req.runner_id) {
      await payments.freezeRunnerCard(req.runner_id);
      await db.from("profiles").update({ status: "suspended" }).eq("id", req.runner_id);
    }
    notifyPush(req.requester_id, "Your report was resolved", refund > 0 ? `You've been refunded ${money(refund)}.` : "Open Dart for details.", req);
  } else {
    const back = (req.status_before_dispute ?? "completed") as RequestStatus;
    const wasWithheld = req.payout_status === "withheld";
    const finished = back === "completed";
    await transition(req.id, "disputed", {
      status: back,
      payout_status: wasWithheld ? (finished ? "released" : "pending") : req.payout_status,
      ...(wasWithheld && finished ? { payout_released_at: now } : {}),
      // A rejected dispute on a dropped-off order releases on the next maintenance run.
      ...(back === "dropped_off" ? { auto_release_at: now } : {}),
    });
    if (wasWithheld && finished) await payments.releasePayout(req, "dispute rejected");
    notifyPush(req.requester_id, "Your report was reviewed", "No refund was issued. Open Dart for details.", req);
  }

  await db
    .from("disputes")
    .update({ status: input.outcome === "refund" ? "refunded" : "rejected", resolution_note: input.note.trim() || null, resolved_at: now })
    .eq("id", disputeId);
  return { ok: true };
}

export async function setUserStatus(adminId: string, userId: string, status: Profile["status"]): Promise<ActionResult> {
  if (!(await requireAdmin(adminId))) return fail("Admins only");
  await admin().from("profiles").update({ status }).eq("id", userId);
  // Suspended/banned runners can't use their card; reinstated ones get it back (empty).
  if (status === "active") await payments.unfreezeRunnerCard(userId);
  else await payments.freezeRunnerCard(userId);
  return { ok: true };
}

export async function freezeRunnerCard(adminId: string, runnerId: string): Promise<ActionResult> {
  if (!(await requireAdmin(adminId))) return fail("Admins only");
  await payments.freezeRunnerCard(runnerId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Maintenance: expire open requests, release no-code fallbacks after 3 hours.
// Runs lazily on page loads (throttled) and from /api/cron.
// ---------------------------------------------------------------------------

let lastRun = 0;

export async function runMaintenance({ force = false } = {}) {
  if (!force && Date.now() - lastRun < 30_000) return;
  lastRun = Date.now();
  const db = admin();
  const now = new Date().toISOString();

  const { data: expired } = await db
    .from("requests")
    .update({ status: "expired" })
    .eq("status", "open")
    .lte("expires_at", now)
    .select("*")
    .returns<DartRequest[]>();
  for (const req of expired ?? []) {
    await payments.releaseHold(req, "expired with no runner");
    notifyPush(req.requester_id, "Your request closed", `No runner picked up "${shortItems(req.items)}". You weren't charged.`, req);
  }

  const { data: due } = await db
    .from("requests")
    .select("*")
    .eq("status", "dropped_off")
    .lte("auto_release_at", now)
    .returns<DartRequest[]>();
  for (const req of due ?? []) await finishOrder(req, "fallback");

  // 45-minute delivery window.
  const { data: lateUnbought } = await db
    .from("requests")
    .select("*")
    .eq("status", "claimed")
    .lte("deliver_by", now)
    .returns<DartRequest[]>();
  for (const req of lateUnbought ?? []) await unclaim(req, "timed_out");

  const { data: lateBought } = await db
    .from("requests")
    .update({ overdue_notified_at: now })
    .in("status", ["purchased", "delivering"])
    .lte("deliver_by", now)
    .is("overdue_notified_at", null)
    .select("*")
    .returns<DartRequest[]>();
  if (lateBought?.length) {
    await db
      .from("delivery_timeouts")
      .insert(lateBought.map((r) => ({ request_id: r.id, runner_id: r.runner_id, stage: "after_purchase" })));
  }
  for (const req of lateBought ?? []) {
    notifyPush(req.runner_id, "You're past the 45-minute window", "Please hand off the order now. The Dart team has been notified.", req);
    notifyPush(req.requester_id, "Your order is running late", "Your runner has your items but is past the delivery window. If it doesn't arrive, report a problem.", req);
  }

  const warnAt = new Date(Date.now() + DELIVERY_WARNING_MINUTES * 60_000).toISOString();
  const { data: almost } = await db
    .from("requests")
    .update({ deliver_warned_at: now })
    .in("status", ["claimed", "purchased", "delivering"])
    .lte("deliver_by", warnAt)
    .gt("deliver_by", now)
    .is("deliver_warned_at", null)
    .select("*")
    .returns<DartRequest[]>();
  for (const req of almost ?? []) {
    notifyPush(
      req.runner_id,
      `${DELIVERY_WARNING_MINUTES} minutes left to deliver`,
      req.status === "claimed"
        ? "Buy the items soon, or the order goes back on the shopping list."
        : `Hand off "${shortItems(req.items)}" before ${clockTime(req.deliver_by!)}.`,
      req,
    );
  }
}
