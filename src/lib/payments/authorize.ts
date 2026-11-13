import { getStore } from "../config";
import type { Card, DartRequest } from "../types";

export type AuthorizationInput = {
  card: Card;
  request: DartRequest | null;
  amountCents: number;
  merchantCategory: string;
};

export type AuthorizationDecision = { approved: true } | { approved: false; reason: string };

// Real-time approval rule for Dart card purchases (plan section 3): approve
// only if the order is active, the amount is at or under the requester's max
// price, and the store type matches. Anything else is declined.
//
// Pure function so the same rule can back Stripe Issuing's
// `issuing_authorization.request` webhook later.
export function decideAuthorization({ card, request, amountCents, merchantCategory }: AuthorizationInput): AuthorizationDecision {
  if (card.status === "frozen") return { approved: false, reason: "Card is frozen" };
  if (card.status !== "active") return { approved: false, reason: "This card is closed" };
  if (!request || request.id !== card.request_id) return { approved: false, reason: "No active order on this card" };
  if (request.status !== "claimed" || request.runner_id !== card.runner_id) {
    return { approved: false, reason: "Order is not active" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { approved: false, reason: "Invalid amount" };
  if (amountCents > request.max_price_cents || amountCents > card.limit_cents) {
    return { approved: false, reason: "Over the requester's max price" };
  }
  const store = getStore(request.store);
  if (!store || store.category !== merchantCategory || card.allowed_category !== merchantCategory) {
    return { approved: false, reason: "Store type doesn't match this order" };
  }
  return { approved: true };
}
