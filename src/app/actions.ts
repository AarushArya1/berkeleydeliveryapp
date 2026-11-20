"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DORMS, RUNNER_BUDGET } from "@/lib/config";
import { normalizePhone } from "@/lib/format";
import * as orders from "@/lib/orders";
import { payments } from "@/lib/payments";
import type { ActionResult } from "@/lib/types";

// Every action re-reads the session itself; nothing trusts the client.

async function requireUser() {
  const id = await currentUserId();
  if (!id) redirect("/login");
  return id;
}

function done<T extends ActionResult<unknown>>(result: T): T {
  if (result.ok) refresh();
  return result;
}

// ---------------------------------------------------------------------------
// Sign-up
// ---------------------------------------------------------------------------

export async function saveProfile(input: { fullName: string; dorm: string; phone: string; smsConsent: boolean }): Promise<ActionResult> {
  const userId = await requireUser();
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 60) return { ok: false, error: "Enter your name" };
  if (!DORMS.includes(input.dorm)) return { ok: false, error: "Pick your dorm" };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a 10-digit US phone number" };
  if (!input.smsConsent) return { ok: false, error: "Agree to order texts to continue" };
  const { error } = await admin()
    .from("profiles")
    .update({ full_name: fullName, dorm: input.dorm, phone, sms_consent_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  return done({ ok: true });
}

export async function acceptTerms(): Promise<ActionResult> {
  const userId = await requireUser();
  await admin().from("profiles").update({ tos_accepted_at: new Date().toISOString() }).eq("id", userId);
  return done({ ok: true });
}

export async function markHomeScreenDone(): Promise<ActionResult> {
  const userId = await requireUser();
  await admin().from("profiles").update({ home_screen_at: new Date().toISOString() }).eq("id", userId);
  return done({ ok: true });
}

export async function savePushSubscription(sub: { endpoint?: string; keys?: Record<string, string> }): Promise<ActionResult> {
  const userId = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: "Invalid subscription" };

  await admin()
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  return { ok: true };
}

export async function acceptRunnerTerms(): Promise<ActionResult> {
  const userId = await requireUser();
  await admin().from("profiles").update({ runner_terms_accepted_at: new Date().toISOString() }).eq("id", userId);
  return done({ ok: true });
}

/** PAYMENTS PLACEHOLDER for Stripe Connect Express hosted onboarding. */
export async function completePayoutSetup(): Promise<ActionResult> {
  const userId = await requireUser();
  await admin().from("profiles").update({ payouts_ready_at: new Date().toISOString() }).eq("id", userId);
  return done({ ok: true });
}

/**
 * PAYMENTS PLACEHOLDER for creating the runner's Stripe Issuing cardholder +
 * virtual card. One card per runner, made at the end of runner setup.
 */
function validBudget(cents: number) {
  return Number.isInteger(cents) && cents >= RUNNER_BUDGET.minCents && cents <= RUNNER_BUDGET.maxCents && cents % RUNNER_BUDGET.stepCents === 0;
}

export async function createDartCard(budgetCents: number): Promise<ActionResult> {
  const userId = await requireUser();
  if (!validBudget(budgetCents)) return { ok: false, error: "Pick a budget" };
  const db = admin();
  const { data: profile } = await db.from("profiles").select("runner_terms_accepted_at, payouts_ready_at, status").eq("id", userId).single();
  if (!profile?.runner_terms_accepted_at || !profile.payouts_ready_at) return { ok: false, error: "Finish the steps above first" };
  if (profile.status !== "active") return { ok: false, error: "Your account isn't active" };
  const card = await payments.issueRunnerCard(userId);
  await db.from("profiles").update({ runner_budget_cents: budgetCents }).eq("id", userId);
  await db.from("profiles").update({ card_issued_at: card.created_at }).eq("id", userId).is("card_issued_at", null);
  return done({ ok: true });
}

/** The most the runner is willing to have on their Dart card at once. */
export async function setRunnerBudget(budgetCents: number): Promise<ActionResult> {
  const userId = await requireUser();
  if (!validBudget(budgetCents)) return { ok: false, error: "Pick a budget" };
  const { error } = await admin().from("profiles").update({ runner_budget_cents: budgetCents }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  return done({ ok: true });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function postRequest(input: orders.NewRequestInput): Promise<ActionResult> {
  const userId = await requireUser();
  const result = await orders.createRequest(userId, input);
  if (!result.ok) return result;
  redirect(`/orders/${result.data!.id}?posted=1`);
}

export async function claim(requestId: string, etaMinutes: number) {
  const userId = await requireUser();
  return done(await orders.claimRequest(userId, requestId, etaMinutes));
}

export async function releaseClaim(requestId: string) {
  const userId = await requireUser();
  const result = await orders.releaseClaim(userId, requestId);
  if (!result.ok) return result;
  redirect("/run");
}

/** PAYMENTS PLACEHOLDER: a simulated tap only knows the store and amount, like a real one. */
export async function cardTap(amountCents: number, merchantStoreId: string) {
  const userId = await requireUser();
  return done(await orders.simulateCardTap(userId, amountCents, merchantStoreId));
}

/** "I'm paying for this one": points the next tap at this order (two orders at one store). */
export async function armForPayment(requestId: string) {
  const userId = await requireUser();
  return done(await orders.armLoad(userId, requestId));
}

export async function markPurchased(formData: FormData) {
  const userId = await requireUser();
  return done(await orders.markPurchased(userId, String(formData.get("requestId")), formData.get("photo")));
}

export async function enterCode(requestId: string, code: string) {
  const userId = await requireUser();
  return done(await orders.completeWithCode(userId, requestId, code));
}

export async function submitDropoff(formData: FormData) {
  const userId = await requireUser();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const coords = formData.get("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  return done(await orders.submitDropoff(userId, String(formData.get("requestId")), formData.get("photo"), coords));
}

export async function confirmReceived(requestId: string) {
  const userId = await requireUser();
  return done(await orders.confirmReceived(userId, requestId));
}

export async function cancelRequest(requestId: string) {
  const userId = await requireUser();
  return done(await orders.cancelRequest(userId, requestId));
}

export async function openDispute(requestId: string, reason: string, details: string) {
  const userId = await requireUser();
  return done(await orders.openDispute(userId, requestId, reason, details));
}

export async function rate(requestId: string, stars: number, comment: string) {
  const userId = await requireUser();
  return done(await orders.rateCounterpart(userId, requestId, stars, comment));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function resolveDispute(
  disputeId: string,
  input: { outcome: "refund" | "reject"; refundCents: number; payRunner: boolean; suspendRunner: boolean; note: string },
) {
  const userId = await requireUser();
  return done(await orders.resolveDispute(userId, disputeId, input));
}

export async function setUserStatus(targetId: string, status: "active" | "suspended" | "banned") {
  const userId = await requireUser();
  return done(await orders.setUserStatus(userId, targetId, status));
}

export async function freezeRunnerCard(runnerId: string) {
  const userId = await requireUser();
  return done(await orders.freezeRunnerCard(userId, runnerId));
}

export async function runMaintenanceNow(): Promise<ActionResult> {
  const userId = await requireUser();
  const { data } = await admin().from("profiles").select("is_admin").eq("id", userId).single();
  if (!data?.is_admin) return { ok: false, error: "Admins only" };
  await orders.runMaintenance({ force: true });
  return done({ ok: true });
}
