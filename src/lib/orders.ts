import "server-only";
import { admin } from "./supabase/admin";
import { quote, runnerFeeCents } from "./fees";
import {
  AUTO_COMPLETE_HOURS,
  DELIVERY_WARNING_MINUTES,
  DELIVERY_WINDOW_MINUTES,
  DISPUTE_WINDOW_HOURS,
  DURATIONS,
  ETA_OPTIONS,
  LAUNCH_ZONES,
  LIMITS,
  PAY_METHOD_LABEL,
  MAX_CODE_ATTEMPTS,
  UNPAID_BAN_HOURS,
  findRestricted,
  getStore,
  runnerBudgetCents,
  type PayMethod,
} from "./config";
import { clockTime, displayName, money } from "./format";
import { inBackground } from "./background";
import { orderUrl, sendPush, sendSms } from "./notify";
import { uploadPhoto, validatePhoto } from "./storage";
import { isOnboarded, isRunnerReady } from "./auth";
import { owesRunner, payMethods } from "./pay";
import type { ActionResult, DartRequest, Profile, RequestStatus } from "./types";

// The order state machine. No money moves through Dart: the runner buys the
// items with their own money and the requester pays them back (receipt total +
// runner fee) by Venmo or Zelle at handoff. Dart tracks who owes what and
// enforces the consequences when either side breaks the deal.
//
// Every function here is called from a server action
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


/** Logged for the team dashboard ("ran out of time"). No automatic penalty. */
async function recordTimeout(runnerId: string, requestId: string, stage: "before_purchase" | "after_purchase") {
  await admin().from("delivery_timeouts").insert({ request_id: requestId, runner_id: runnerId, stage });
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
  payAck: boolean;
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
  if (!input.payAck) return fail("Agree to pay your runner at handoff");
  if (!getStore(input.store)) return fail("Pick a store");
  if (!LAUNCH_ZONES.includes(input.zone)) return fail("Pick a drop-off area");
  if (spot.length < 2 || spot.length > 120) return fail("Add a drop-off spot (building and where to meet)");
  const max = input.maxPriceCents;
  if (!Number.isInteger(max) || max < LIMITS.minOrderCents) return fail(`Orders must be at least ${money(LIMITS.minOrderCents)} in items`);
  if (max > LIMITS.launchMaxCents) return fail(`Max price is capped at ${money(LIMITS.launchMaxCents)} during launch`);
  if (!DURATIONS.some((d) => d.hours === input.durationHours)) return fail("Pick how long the request stays open");

  const q = quote(max, input.store, input.zone);
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
      runner_fee_cents: q.runnerFeeCents,
      distance_miles: q.miles,
      expires_at: new Date(Date.now() + input.durationHours * 3600_000).toISOString(),
    })
    .select("*")
    .single<DartRequest>();
  if (error || !req) return fail("Couldn't post your request. Try again.");

  await db.from("request_private").insert({ request_id: req.id, dropoff_spot: spot });
  await db.from("profiles").update({ default_spot: spot }).eq("id", userId);

  return { ok: true, data: { id: req.id } };
}

// ---------------------------------------------------------------------------
// Runner: claim / release
// ---------------------------------------------------------------------------

export async function claimRequest(runnerId: string, requestId: string, etaMinutes: number): Promise<ActionResult> {
  const runner = await getProfile(runnerId);
  const blocked = requireActive(runner);
  if (blocked) return fail(blocked);
  if (!isRunnerReady(runner!)) return fail("Finish runner setup before claiming");
  if (!ETA_OPTIONS.some((o) => o.minutes === etaMinutes)) return fail("Pick when you'll arrive");

  const req = await getRequest(requestId);
  if (!req || req.status !== "open" || new Date(req.expires_at) <= new Date()) return fail("This request is no longer open");
  if (req.requester_id === runnerId) return fail("You can't claim your own request");
  const budget = runnerBudgetCents(runner!);
  if (req.max_price_cents > budget) return fail(`This order could cost up to ${money(req.max_price_cents)}, over your ${money(budget)} max. Raise your max on the Run tab to claim it.`);

  const requester = await getProfile(req.requester_id);
  const shared = payMethods(runner!).filter((m) => requester && payMethods(requester).includes(m));
  if (shared.length === 0) {
    const theirs = requester ? payMethods(requester).map((m) => PAY_METHOD_LABEL[m]).join(" or ") : "another app";
    return fail(`This requester pays with ${theirs}. Add it to your profile to take this order.`);
  }

  const now = Date.now();
  const eta = new Date(now + etaMinutes * 60_000).toISOString();
  const deliverBy = new Date(now + DELIVERY_WINDOW_MINUTES * 60_000).toISOString();
  const claimed = await admin()
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
  if (claimed.error || !claimed.data) return fail("Someone else just claimed this one");
  const order = claimed.data;

  const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  await admin().from("request_codes").upsert({ request_id: requestId, code, attempts: 0 });

  const who = displayName(runner!.full_name);
  inBackground(() =>
    sendSms(
      order.requester_id,
      `Dart: ${who} claimed your request (${shortItems(order.items)}) and expects to arrive around ${clockTime(eta)}. At handoff, pay them the receipt total + ${money(order.runner_fee_cents)} by Venmo or Zelle, then give them your 4-digit code (in the app).`,
      order.id,
    ),
  );
  notifyPush(order.requester_id, `${who} claimed your order`, `Arriving around ${clockTime(eta)}. Your handoff code is in the app.`, order);
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

  if (why === "timed_out") {
    notifyPush(
      req.runner_id,
      "Time's up — order released",
      `You didn't buy "${shortItems(req.items)}" within ${DELIVERY_WINDOW_MINUTES} minutes of claiming it, so it went back on the shopping list for someone else.`,
      req,
    );
    await recordTimeout(req.runner_id!, req.id, "before_purchase");
  }
  notifyPush(
    req.requester_id,
    why === "timed_out" ? "Your runner ran out of time" : "Your runner can't make it",
    stillOpen ? "Your request is back on the shopping list." : "Your request closed. You don't owe anything.",
    req,
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Runner: buy (own money), deliver, get paid
// ---------------------------------------------------------------------------

/**
 * Receipt first. Right after buying, the runner uploads a photo of the receipt
 * and enters its total. The final runner fee is worked out from that real
 * price, and the requester is sent the photo and the exact amount to check
 * and confirm before paying.
 */
export async function markPurchased(
  runnerId: string,
  requestId: string,
  receiptPhoto: unknown,
  itemsPhoto: unknown,
  receiptCents: number,
): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || req.status !== "claimed") return fail("This order isn't waiting to be bought");
  if (!validatePhoto(receiptPhoto)) return fail("Add a photo of the receipt (under 8 MB)");
  if (itemsPhoto != null && !validatePhoto(itemsPhoto)) return fail("The items photo didn't work. Retake it or leave it out.");
  if (!Number.isInteger(receiptCents) || receiptCents <= 0) return fail("Enter the receipt total");
  if (receiptCents > req.max_price_cents) {
    return fail(`The requester's max is ${money(req.max_price_cents)}, so that's the most they owe for items.`);
  }

  const miles = req.distance_miles ?? quote(req.max_price_cents, req.store, req.dropoff_zone).miles;
  const feeCents = runnerFeeCents(receiptCents, miles);
  const owedCents = receiptCents + feeCents;

  const receiptPath = await uploadPhoto(requestId, "receipt", receiptPhoto);
  const itemsPath = itemsPhoto ? await uploadPhoto(requestId, "items", itemsPhoto as File) : null;
  const now = new Date().toISOString();
  const updated = await transition(requestId, "claimed", {
    status: "delivering",
    purchase_cents: receiptCents,
    purchase_merchant: getStore(req.store)?.name ?? "Store",
    runner_fee_cents: feeCents,
    charged_cents: owedCents,
    purchased_at: now,
    receipt_photo_path: receiptPath,
    receipt_confirmed_at: null,
    items_photo_path: itemsPath,
    picked_up_at: now,
  });
  if (!updated) return fail("This order already changed");

  const msg = `Your items were bought. Check the receipt photo in the app: ${money(receiptCents)} + ${money(feeCents)} runner fee = ${money(owedCents)}, paid at handoff.`;
  inBackground(() => sendSms(req.requester_id, `Dart: ${msg}`, req.id));
  notifyPush(req.requester_id, `Check your receipt: ${money(owedCents)} total`, msg, req);
  return { ok: true };
}

/** Requester: the receipt photo matches the total the runner entered. */
export async function confirmReceipt(requesterId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId || !owesRunner(req)) return fail("Nothing to confirm on this order");
  if (req.receipt_confirmed_at) return { ok: true };
  await admin().from("requests").update({ receipt_confirmed_at: new Date().toISOString() }).eq("id", requestId).is("receipt_confirmed_at", null);
  notifyPush(req.runner_id, "Receipt confirmed", `The requester confirmed ${money(req.charged_cents)}. Collect it at handoff.`, req);
  return { ok: true };
}

/** No-show: the runner leaves the order at the spot with a photo. The requester still owes. */
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
  const updated = await transition(requestId, "delivering", {
    status: "dropped_off",
    dropoff_photo_path: path,
    dropoff_lat: coords?.lat ?? null,
    dropoff_lng: coords?.lng ?? null,
    dropped_off_at: new Date().toISOString(),
  });
  if (!updated) return fail("This order already changed");

  const requester = await getProfile(req.requester_id);
  if (requester) {
    await admin().from("profiles").update({ no_show_count: requester.no_show_count + 1 }).eq("id", requester.id);
  }
  const msg = `Your runner couldn't find you and left your order at your drop-off spot. You still owe ${money(req.charged_cents)}: pay now in the app.`;
  inBackground(() => sendSms(req.requester_id, `Dart: ${msg}`, req.id));
  notifyPush(req.requester_id, "Your order was left at your drop-off spot", msg, req);
  return { ok: true };
}

/**
 * Handoff: the requester pays, then gives the runner their 4-digit code. The
 * runner entering it confirms both the handoff and the payment, and completes the order.
 */
export async function completeWithCode(runnerId: string, requestId: string, code: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || req.status !== "delivering") return fail("This order isn't ready for handoff");

  const db = admin();
  const { data: row } = await db.from("request_codes").select("*").eq("request_id", requestId).maybeSingle();
  if (!row) return fail("No code on this order. Tap \"I got paid\" instead.");
  if (row.attempts >= MAX_CODE_ATTEMPTS) return fail("Too many wrong codes. Once you're paid, tap \"I got paid\" instead.");
  if (row.code !== code.trim()) {
    await db.from("request_codes").update({ attempts: row.attempts + 1 }).eq("request_id", requestId);
    const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
    return fail(left > 0 ? `That code didn't match. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Once you're paid, tap \"I got paid\" instead.");
  }
  // Handing over the code means the requester accepted the receipt and paid.
  if (!req.receipt_confirmed_at) await db.from("requests").update({ receipt_confirmed_at: new Date().toISOString() }).eq("id", requestId);
  return settle(req, "confirmed", "code");
}

/** Requester: "I've paid" (Venmo or Zelle). The runner confirms; if they never answer, it completes on its own. */
export async function reportPaid(requesterId: string, requestId: string, method: PayMethod): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId || !owesRunner(req)) return fail("Nothing to pay on this order");
  if (!(method in PAY_METHOD_LABEL)) return fail("Pick how you paid");
  if (!req.receipt_confirmed_at) return fail("Check and confirm the receipt first");
  if (req.paid_reported_at) return { ok: true };

  const now = Date.now();
  const { data } = await admin()
    .from("requests")
    .update({
      paid_reported_at: new Date(now).toISOString(),
      paid_method: method,
      auto_complete_at: new Date(now + AUTO_COMPLETE_HOURS * 3600_000).toISOString(),
    })
    .eq("id", requestId)
    .is("paid_reported_at", null)
    .select("id");
  if (!data?.length) return fail("This order just changed. Refresh and try again.");
  notifyPush(
    req.runner_id,
    `Paid ${money(req.charged_cents)} on ${PAY_METHOD_LABEL[method]}?`,
    "The requester says they paid you. Check your app and confirm in Dart.",
    req,
  );
  return { ok: true };
}

/** Runner: "I got paid." Completes the order (or settles a cancelled or reported one). */
export async function confirmPaid(runnerId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || !owesRunner(req)) return fail("Nothing to confirm on this order");
  return settle(req, "confirmed");
}

async function settle(req: DartRequest, how: "confirmed" | "auto" | "admin", method: "code" | "confirmed" = "confirmed"): Promise<ActionResult> {
  const now = new Date().toISOString();
  const db = admin();
  // A cancelled-after-purchase order stays cancelled; everything else completes.
  const stillCancelled = req.status === "cancelled";
  const { data: done } = await db
    .from("requests")
    .update({ ...(stillCancelled ? {} : { status: "completed" }), completed_at: now, completion_method: method, auto_complete_at: null })
    .eq("id", req.id)
    .eq("status", req.status)
    .is("completed_at", null)
    .select("*")
    .maybeSingle<DartRequest>();
  if (!done) return fail("This order already changed");

  // Paid after a non-payment report: close it and lift the suspension it caused.
  if (req.status === "disputed") {
    await db.from("disputes").update({ status: "resolved", resolution_note: "Runner confirmed payment", resolved_at: now }).eq("request_id", req.id).eq("status", "open");
    await reinstateIfClear(req.requester_id);
  }

  if (how !== "confirmed") notifyPush(done.runner_id, "Order completed", how === "auto" ? `The requester reported paying ${money(done.charged_cents)} ${AUTO_COMPLETE_HOURS} hours ago.` : "The Dart team closed this order.", done);
  notifyPush(done.requester_id, stillCancelled ? "All settled" : "Order complete", stillCancelled ? "Your runner confirmed your payment." : "Thanks for using Dart! Rate your runner.", done);
  return { ok: true };
}

/** A requester suspended for not paying gets their account back once nothing is unpaid. */
async function reinstateIfClear(requesterId: string) {
  const db = admin();
  const { data: open } = await db.from("disputes").select("id, requests!inner(requester_id)").eq("kind", "unpaid").eq("status", "open").eq("requests.requester_id", requesterId);
  const requester = await getProfile(requesterId);
  if (!open?.length && requester?.status === "suspended") await db.from("profiles").update({ status: "active" }).eq("id", requesterId);
}

/** Runner: the requester took the items (or cancelled) and didn't pay. Suspends them right away. */
export async function reportUnpaid(runnerId: string, requestId: string, details: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.runner_id !== runnerId || !owesRunner(req) || req.status === "disputed") return fail("You can't report this order");

  const updated = await transition(req.id, req.status, { status: "disputed", status_before_dispute: req.status });
  if (!updated) return fail("This order just changed. Refresh and try again.");

  const db = admin();
  await db.from("disputes").insert({
    request_id: req.id,
    opened_by: runnerId,
    kind: "unpaid",
    reason: "Requester didn't pay",
    details: details.trim().slice(0, 1000) || null,
  });
  const requester = await getProfile(req.requester_id);
  if (requester && !requester.is_admin && requester.status === "active") {
    await db.from("profiles").update({ status: "suspended" }).eq("id", requester.id);
  }

  const msg = `Your runner reported that you haven't paid ${money(req.charged_cents)} for "${shortItems(req.items)}". Your account is suspended. Pay them within ${UNPAID_BAN_HOURS} hours or it will be banned.`;
  inBackground(() => sendSms(req.requester_id, `Dart: ${msg}`, req.id));
  notifyPush(req.requester_id, "Payment overdue: account suspended", msg, req);
  await notifyAdmins("Unpaid order reported", shortItems(req.items), req.id);
  return { ok: true };
}

async function notifyAdmins(title: string, body: string, requestId: string) {
  const { data: admins } = await admin().from("profiles").select("id").eq("is_admin", true);
  for (const a of admins ?? []) inBackground(() => sendPush(a.id, { title, body, url: "/admin" }, requestId));
}

// ---------------------------------------------------------------------------
// Cancellations
// ---------------------------------------------------------------------------

export async function cancelRequest(requesterId: string, requestId: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId) return fail("Request not found");
  const now = new Date().toISOString();

  if (req.status === "open") {
    const done = await transition(req.id, "open", { status: "cancelled", cancelled_at: now, cancelled_stage: "before_claim" });
    return done ? { ok: true } : fail("This request just changed. Refresh and try again.");
  }

  if (req.status === "claimed") {
    const done = await transition(req.id, "claimed", { status: "cancelled", cancelled_at: now, cancelled_stage: "after_claim" });
    if (!done) return fail("Your runner just bought the items. Refresh to see the update.");
    await admin().from("request_codes").delete().eq("request_id", req.id);
    notifyPush(req.runner_id, "Order cancelled", "The requester cancelled before you bought anything. Don't buy it.", req);
    return { ok: true };
  }

  // The runner blew the delivery window: the requester can walk away owing nothing.
  if (req.status === "delivering" && req.deliver_by && new Date(req.deliver_by) <= new Date()) {
    const done = await transition(req.id, "delivering", { status: "cancelled", cancelled_at: now, cancelled_stage: "runner_late" });
    if (!done) return fail("This order just changed. Refresh and try again.");
    notifyPush(req.runner_id, "Order cancelled: you were late", "You missed the delivery window, so the requester cancelled and owes nothing. Return the items with your receipt.", req);
    return { ok: true };
  }

  if (req.status === "delivering" || req.status === "dropped_off") {
    const done = await transition(req.id, req.status, { status: "cancelled", cancelled_at: now, cancelled_stage: "after_purchase" });
    if (!done) return fail("This order just changed. Refresh and try again.");
    notifyPush(
      req.runner_id,
      "Order cancelled after you bought it",
      `The requester still owes you ${money(req.charged_cents)}. Keep your receipt: if they don't pay, report it and return the items.`,
      req,
    );
    return { ok: true };
  }

  return fail("This order can't be cancelled");
}

// ---------------------------------------------------------------------------
// Disputes, ratings
// ---------------------------------------------------------------------------

export const DISPUTE_REASONS = ["Receipt doesn't match", "Wrong or missing items", "Items damaged", "Asked for more than the receipt", "Runner never showed up", "Other"] as const;

export async function openDispute(requesterId: string, requestId: string, reason: string, details: string): Promise<ActionResult> {
  const req = await getRequest(requestId);
  if (!req || req.requester_id !== requesterId) return fail("Request not found");
  if (!(DISPUTE_REASONS as readonly string[]).includes(reason)) return fail("Pick what went wrong");
  const inProgress = ["claimed", "delivering", "dropped_off"].includes(req.status);
  const recentlyDone =
    req.status === "completed" && req.completed_at && Date.now() - new Date(req.completed_at).getTime() < DISPUTE_WINDOW_HOURS * 3600_000;
  if (!inProgress && !recentlyDone) return fail("This order can't be reported");

  const updated = await transition(req.id, req.status, { status: "disputed", status_before_dispute: req.status, auto_complete_at: null });
  if (!updated) return fail("This order just changed. Refresh and try again.");

  await admin().from("disputes").insert({ request_id: req.id, opened_by: requesterId, kind: "requester", reason, details: details.trim().slice(0, 1000) || null });
  notifyPush(req.runner_id, "A problem was reported on your order", "The Dart team is reviewing it and will contact you.", req);
  await notifyAdmins("New report", `${reason}: ${shortItems(req.items)}`, req.id);
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
  input: { outcome: "settled" | "cancel"; banRequester: boolean; suspendRunner: boolean; note: string },
): Promise<ActionResult> {
  if (!(await requireAdmin(adminId))) return fail("Admins only");
  const db = admin();
  const { data: dispute } = await db.from("disputes").select("*").eq("id", disputeId).single();
  if (!dispute || dispute.status !== "open") return fail("Already resolved");
  const req = await getRequest(dispute.request_id);
  if (!req || req.status !== "disputed") return fail("Order is not in review");

  const now = new Date().toISOString();
  await db.from("disputes").update({ status: "resolved", resolution_note: input.note.trim() || null, resolved_at: now }).eq("id", disputeId);
  if (input.outcome === "settled") {
    // Payment sorted out (or the problem wasn't real): the order counts as done.
    if (req.status_before_dispute === "completed") await transition(req.id, "disputed", { status: "completed" });
    else await settle(req, "admin");
  } else {
    // Nothing owed: items returned or never delivered.
    await transition(req.id, "disputed", { status: "cancelled", cancelled_at: now, cancelled_stage: req.purchase_cents != null ? "after_purchase" : "after_claim", completed_at: now });
  }
  if (input.banRequester) await db.from("profiles").update({ status: "banned" }).eq("id", req.requester_id);
  else if (dispute.kind === "unpaid") await reinstateIfClear(req.requester_id);
  if (input.suspendRunner && req.runner_id) await db.from("profiles").update({ status: "suspended" }).eq("id", req.runner_id);

  const note = input.note.trim() || "Open Dart for details.";
  notifyPush(req.requester_id, "Your order was reviewed", note, req);
  notifyPush(req.runner_id, "Your order was reviewed", note, req);
  return { ok: true };
}

export async function setUserStatus(adminId: string, userId: string, status: Profile["status"]): Promise<ActionResult> {
  if (!(await requireAdmin(adminId))) return fail("Admins only");
  await admin().from("profiles").update({ status }).eq("id", userId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Maintenance: expiry, the delivery window, auto-complete, unpaid bans.
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
    notifyPush(req.requester_id, "Your request closed", `No runner picked up "${shortItems(req.items)}". You don't owe anything.`, req);
  }

  // Requester said they paid and the runner never confirmed or reported: done.
  const { data: reportedPaid } = await db
    .from("requests")
    .select("*")
    .in("status", ["delivering", "dropped_off", "cancelled"])
    .is("completed_at", null)
    .lte("auto_complete_at", now)
    .returns<DartRequest[]>();
  for (const req of reportedPaid ?? []) await settle(req, "auto");

  // Reported unpaid, never said they paid, and the grace period is over: banned.
  const banBefore = new Date(Date.now() - UNPAID_BAN_HOURS * 3600_000).toISOString();
  const { data: unpaid } = await db
    .from("disputes")
    .select("id, request_id, requests!inner(requester_id, paid_reported_at)")
    .eq("kind", "unpaid")
    .eq("status", "open")
    .lte("created_at", banBefore)
    .is("requests.paid_reported_at", null);
  for (const d of unpaid ?? []) {
    const r = (Array.isArray(d.requests) ? d.requests[0] : d.requests) as { requester_id: string };
    const requester = await getProfile(r.requester_id);
    if (requester && !requester.is_admin && requester.status !== "banned") {
      await db.from("profiles").update({ status: "banned" }).eq("id", requester.id);
      notifyPush(requester.id, "Your account is banned", `You didn't pay your runner within ${UNPAID_BAN_HOURS} hours. The Dart team will contact you.`, { id: d.request_id });
    }
  }

  // Delivery window, counted from the claim.
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
    .eq("status", "delivering")
    .lte("deliver_by", now)
    .is("overdue_notified_at", null)
    .select("*")
    .returns<DartRequest[]>();
  for (const req of lateBought ?? []) {
    await recordTimeout(req.runner_id!, req.id, "after_purchase");
    notifyPush(req.runner_id, `You're past the ${DELIVERY_WINDOW_MINUTES}-minute window`, "Hand off the order now. The requester can now cancel and owe nothing.", req);
    notifyPush(req.requester_id, "Your order is running late", "Your runner is past the delivery window. You can wait, or cancel and owe nothing.", req);
  }

  const warnAt = new Date(Date.now() + DELIVERY_WARNING_MINUTES * 60_000).toISOString();
  const { data: almost } = await db
    .from("requests")
    .update({ deliver_warned_at: now })
    .in("status", ["claimed", "delivering"])
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
