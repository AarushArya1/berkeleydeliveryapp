import { FEES, RESERVE_SHARE } from "./config";

export type Breakdown = {
  itemsCents: number;
  runnerFeeCents: number;
  dartFeeCents: number;
  processingCents: number;
  totalCents: number;
};

// Plan section 6: requester pays items + runner fee + Dart fee + card
// processing (2.9% + 30¢ of the above), shown as one total.
export function breakdown(
  itemsCents: number,
  runnerFeeCents = FEES.runnerFeeCents,
  dartFeeCents = FEES.dartFeeCents,
): Breakdown {
  const base = itemsCents + runnerFeeCents + dartFeeCents;
  const processingCents = Math.round(base * FEES.processingPct + FEES.processingFixedCents);
  return { itemsCents, runnerFeeCents, dartFeeCents, processingCents, totalCents: base + processingCents };
}

export function reserveShareCents(dartFeeCents: number) {
  return Math.round(dartFeeCents * RESERVE_SHARE);
}
