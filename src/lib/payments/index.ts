import "server-only";
import { admin } from "../supabase/admin";
import type { Card, CardLoad, DartRequest } from "../types";
import { getStore } from "../config";

// ============================================================================
// PAYMENTS PLACEHOLDER
//
// Nothing here moves real money. Each call records what *would* happen in the
// `ledger` table so the pilot's money flow can be checked end to end. When
// Stripe is wired up, swap each function body for the matching Stripe call:
//
//   placeHold      -> PaymentIntent, capture_method: "manual" (card hold)
//   releaseHold    -> PaymentIntent cancel
//   capture        -> PaymentIntent capture with amount_to_capture (rest released)
//   refund         -> Refund, funded from the Dart reserve
//   issueRunnerCard -> Issuing Cardholder + one virtual Card per runner, created
//                     at runner sign-up
//   loadCard / unloadCard -> no Stripe call needed: loads are Dart's own
//                     records, and the `issuing_authorization.request` webhook
//                     approves each tap against them (decideAuthorization).
//                     Optionally keep spending_controls.per_authorization at
//                     the largest open load as a backstop
//   freezeRunnerCard -> Card update: status "inactive" + flag for review
//   releasePayout  -> Transfer to the runner's Connect Express account
//                     (daily standard payout happens on Stripe's side)
// ============================================================================

async function record(entry: { request_id?: string | null; user_id?: string | null; kind: string; amount_cents: number; note?: string }) {
  const { error } = await admin().from("ledger").insert(entry);
  if (error) throw new Error(`ledger: ${error.message}`);
}

export const payments = {
  async placeHold(req: Pick<DartRequest, "id" | "requester_id" | "hold_cents">) {
    await record({ request_id: req.id, user_id: req.requester_id, kind: "hold_placed", amount_cents: req.hold_cents });
  },

  async releaseHold(req: Pick<DartRequest, "id" | "requester_id" | "hold_cents">, note: string) {
    await record({ request_id: req.id, user_id: req.requester_id, kind: "hold_released", amount_cents: req.hold_cents, note });
  },

  /** Charge `chargeCents` from the hold; the rest of the hold is released. */
  async capture(req: Pick<DartRequest, "id" | "requester_id" | "hold_cents">, chargeCents: number) {
    await record({ request_id: req.id, user_id: req.requester_id, kind: "charge_captured", amount_cents: chargeCents });
    const remainder = req.hold_cents - chargeCents;
    if (remainder > 0) {
      await record({ request_id: req.id, user_id: req.requester_id, kind: "hold_released", amount_cents: remainder, note: "unused part of hold" });
    }
  },

  async reserveContribution(req: Pick<DartRequest, "id">, cents: number) {
    await record({ request_id: req.id, kind: "reserve_in", amount_cents: cents, note: "share of Dart fee" });
  },

  async refund(req: Pick<DartRequest, "id" | "requester_id">, cents: number, note: string) {
    await record({ request_id: req.id, user_id: req.requester_id, kind: "refund", amount_cents: cents, note });
    await record({ request_id: req.id, kind: "reserve_out", amount_cents: cents, note });
  },

  /** The runner's one Dart card, created at runner sign-up. Returns the existing card if any. */
  async issueRunnerCard(runnerId: string): Promise<Card> {
    const db = admin();
    const { data: existing } = await db.from("cards").select("*").eq("runner_id", runnerId).maybeSingle<Card>();
    if (existing) return existing;
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 3);
    const { data, error } = await db
      .from("cards")
      .insert({
        runner_id: runnerId,
        last4: String(Math.floor(1000 + Math.random() * 9000)),
        exp: `${String(exp.getMonth() + 1).padStart(2, "0")}/${String(exp.getFullYear() % 100).padStart(2, "0")}`,
        status: "active",
      })
      .select("*")
      .single<Card>();
    if (error || !data) {
      // Two taps at once: the unique runner_id constraint let only one through.
      const { data: raced } = await db.from("cards").select("*").eq("runner_id", runnerId).maybeSingle<Card>();
      if (raced) return raced;
      throw new Error(`card: ${error?.message}`);
    }
    await record({ user_id: runnerId, kind: "card_created", amount_cents: 10, note: "Issuing virtual card fee" });
    return data;
  },

  /** Add a claimed order to the runner's card: its max price, at its store, for one purchase. */
  async loadCard(card: Card, req: Pick<DartRequest, "id" | "max_price_cents" | "store">): Promise<CardLoad> {
    const { data, error } = await admin()
      .from("card_loads")
      .insert({
        card_id: card.id,
        runner_id: card.runner_id,
        request_id: req.id,
        amount_cents: req.max_price_cents,
        store: req.store,
        allowed_category: getStore(req.store)?.category ?? "unknown",
      })
      .select("*")
      .single<CardLoad>();
    if (error || !data) throw new Error(`card load: ${error?.message}`);
    return data;
  },

  /** Close this order's load: "spent" after its one purchase, otherwise dropped. */
  async unloadCard(requestId: string, reason: "purchased" | "released" | "timed_out" | "cancelled") {
    await admin()
      .from("card_loads")
      .update({ status: reason === "purchased" ? "spent" : "unloaded", unload_reason: reason, armed_until: null, closed_at: new Date().toISOString() })
      .eq("request_id", requestId)
      .eq("status", "loaded");
  },

  /** Misuse or suspension: drop every load and freeze the card. */
  async freezeRunnerCard(runnerId: string) {
    const db = admin();
    const now = new Date().toISOString();
    await db
      .from("card_loads")
      .update({ status: "unloaded", unload_reason: "frozen", armed_until: null, closed_at: now })
      .eq("runner_id", runnerId)
      .eq("status", "loaded");
    await db.from("cards").update({ status: "frozen", frozen_at: now }).eq("runner_id", runnerId);
  },

  /** Account reinstated: the card works again (still empty until the next claim). */
  async unfreezeRunnerCard(runnerId: string) {
    await admin().from("cards").update({ status: "active", frozen_at: null }).eq("runner_id", runnerId).eq("status", "frozen");
  },

  async releasePayout(req: Pick<DartRequest, "id" | "runner_id" | "runner_fee_cents">, note: string) {
    await record({ request_id: req.id, user_id: req.runner_id, kind: "payout_released", amount_cents: req.runner_fee_cents, note });
  },
};
