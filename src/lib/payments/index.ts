import "server-only";
import { admin } from "../supabase/admin";
import type { Card, DartRequest } from "../types";
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
//   issueCard      -> Issuing virtual Card for one order (Cardholder created on
//                     the runner's first claim), with spending_controls set to
//                     the order's max price and store type
//   closeCard      -> Card update: status "canceled" (single-use, never reopened)
//   freezeRunnerCards -> Card update: status "inactive" + flag for review
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

  /**
   * A new temporary card for one claimed order, loaded with its max price and
   * locked to its store type. Expires when the order's request window closes
   * (holds can't outlive ~7 days anyway).
   */
  async issueCard(runnerId: string, req: Pick<DartRequest, "id" | "max_price_cents" | "store" | "expires_at">): Promise<Card> {
    const store = getStore(req.store);
    const exp = new Date(req.expires_at);
    const { data, error } = await admin()
      .from("cards")
      .insert({
        runner_id: runnerId,
        request_id: req.id,
        last4: String(Math.floor(1000 + Math.random() * 9000)),
        exp: `${String(exp.getMonth() + 1).padStart(2, "0")}/${String(exp.getFullYear() % 100).padStart(2, "0")}`,
        status: "active",
        limit_cents: req.max_price_cents,
        allowed_category: store?.category ?? "unknown",
      })
      .select("*")
      .single<Card>();
    if (error || !data) throw new Error(`card: ${error?.message}`);
    await record({ request_id: req.id, user_id: runnerId, kind: "card_created", amount_cents: 10, note: "Issuing virtual card fee" });
    return data;
  },

  /** Close an order's card for good: "spent" after purchase, "cancelled" otherwise. */
  async closeCard(requestId: string, status: "spent" | "cancelled") {
    await admin()
      .from("cards")
      .update({ status, closed_at: new Date().toISOString() })
      .eq("request_id", requestId)
      .eq("status", "active");
  },

  /** Misuse or suspension: stop every open card the runner holds. */
  async freezeRunnerCards(runnerId: string) {
    await admin()
      .from("cards")
      .update({ status: "frozen", closed_at: new Date().toISOString() })
      .eq("runner_id", runnerId)
      .eq("status", "active");
  },

  async releasePayout(req: Pick<DartRequest, "id" | "runner_id" | "runner_fee_cents">, note: string) {
    await record({ request_id: req.id, user_id: req.runner_id, kind: "payout_released", amount_cents: req.runner_fee_cents, note });
  },
};
