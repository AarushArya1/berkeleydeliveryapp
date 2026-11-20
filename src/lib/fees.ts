import { RUNNER_FEE, ZONE_COORDS, getStore } from "./config";

// Straight-line distance times a walking factor (Berkeley's grid isn't a crow's path).
const WALKING_FACTOR = 1.3;

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** About how far the runner carries the order: store -> drop-off area, in miles. */
export function deliveryMiles(storeId: string, zone: string) {
  const store = getStore(storeId);
  const dropoff = ZONE_COORDS[zone];
  if (!store || !dropoff) return 1;
  return Math.round(haversineMiles(store, dropoff) * WALKING_FACTOR * 10) / 10;
}

/** What the requester pays the runner on top of the receipt (plan: "Dart decides how much extra"). */
export function runnerFeeCents(maxItemCents: number, miles: number) {
  const f = RUNNER_FEE;
  const raw = f.baseCents + f.perMileCents * miles + f.shareOfItems * maxItemCents;
  const rounded = Math.ceil(raw / f.roundToCents) * f.roundToCents;
  return Math.min(f.maxCents, Math.max(f.minCents, rounded));
}

export function quote(maxItemCents: number, storeId: string, zone: string) {
  const miles = deliveryMiles(storeId, zone);
  return { miles, runnerFeeCents: runnerFeeCents(maxItemCents, miles) };
}
