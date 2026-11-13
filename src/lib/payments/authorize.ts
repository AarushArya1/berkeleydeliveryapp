import { getStore } from "../config";
import type { Card, CardLoad, DartRequest } from "../types";

export type OpenLoad = { load: CardLoad; request: DartRequest | null };

export type AuthorizationInput = {
  card: Card;
  /** The card's open loads (one per order the runner has claimed and not bought yet). */
  loads: OpenLoad[];
  amountCents: number;
  merchantStoreId: string;
  merchantCategory: string;
  now?: Date;
};

export type AuthorizationDecision =
  | { approved: true; loadId: string; requestId: string }
  | { approved: false; reason: string; loadId: string | null; requestId: string | null };

// Real-time approval rule for Dart card purchases (plan section 3).
//
// One card per runner, one load per claimed order. A tap only knows the store
// and the amount, so it's matched to the open load for that store. If the
// runner has two orders at the same store, they first mark which one they're
// paying for ("armed"). The matched order must still be claimed and inside its
// delivery window, and the amount at or under its max price. Each load
// approves one purchase; anything else is declined.
//
// Pure function so the same rule can back Stripe Issuing's
// `issuing_authorization.request` webhook later (merchant matched on
// merchant_data.network_id instead of a store id).
export function decideAuthorization({ card, loads, amountCents, merchantStoreId, merchantCategory, now = new Date() }: AuthorizationInput): AuthorizationDecision {
  const decline = (reason: string, match?: OpenLoad): AuthorizationDecision => ({
    approved: false,
    reason,
    loadId: match?.load.id ?? null,
    requestId: match?.load.request_id ?? null,
  });

  if (card.status === "frozen") return decline("Card is frozen");
  const live = loads.filter(
    ({ load, request }) => load.status === "loaded" && request?.status === "claimed" && request.runner_id === card.runner_id,
  );
  if (live.length === 0) return decline("Card is locked. Claim an order to load it");
  if (!Number.isInteger(amountCents) || amountCents <= 0) return decline("Invalid amount");

  const here = live.filter(({ load }) => load.store === merchantStoreId && load.allowed_category === merchantCategory);
  if (here.length === 0) {
    const stores = [...new Set(live.map(({ load }) => storeName(load.store)))];
    return decline(`Your card only works at ${stores.join(" or ")} right now`);
  }

  let match: OpenLoad | undefined = here.length === 1 ? here[0] : undefined;
  if (!match) {
    const armed = here
      .filter(({ load }) => load.armed_until && new Date(load.armed_until) > now)
      .sort((a, b) => new Date(b.load.armed_until!).getTime() - new Date(a.load.armed_until!).getTime());
    match = armed[0];
  }
  if (!match) return decline(`You have ${here.length} orders at ${storeName(merchantStoreId)}. Tap "I'm paying for this one" on the order first`);

  const { load, request } = match;
  if (request!.deliver_by && new Date(request!.deliver_by) <= now) return decline("This order's delivery window is over", match);
  if (amountCents > load.amount_cents || amountCents > request!.max_price_cents) return decline("Over the requester's max price", match);
  return { approved: true, loadId: load.id, requestId: load.request_id };
}

function storeName(id: string) {
  const s = getStore(id);
  return s ? `${s.name} ${s.where}` : "this store";
}
