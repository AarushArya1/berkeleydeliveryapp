// Every number the pilot might tune (fees, limits, penalties) lives here.

// What the requester pays the runner on top of the receipt: a simple formula on
// how far the runner carries it (store -> drop-off area) and how much they
// front. Higher-priced orders pay more, since the runner fronts more money.
// Dart takes no fee during the early MVP.
export const RUNNER_FEE = {
  baseCents: 200,
  perMileCents: 150,
  shareOfItems: 0.08, // of the max item price
  roundToCents: 25,
  minCents: 300,
  maxCents: 800,
};

export const LIMITS = {
  minOrderCents: 1000, // $10 minimum in items
  launchMaxCents: 3000, // $30 cap at launch: the most a runner fronts for one order
};

// The most a runner is willing to pay up front for one order. They only see
// (and can claim) orders at or under it. Set at runner setup, changeable any time.
export const RUNNER_BUDGET = { minCents: 1000, maxCents: LIMITS.launchMaxCents, stepCents: 500, defaultCents: LIMITS.launchMaxCents };

export function runnerBudgetCents(profile: { runner_budget_cents: number | null }) {
  return profile.runner_budget_cents ?? RUNNER_BUDGET.defaultCents;
}

// Breaking the deal (see the Terms):
export const UNPAID_BAN_HOURS = 24; // reported unpaid and still not paid: banned
export const AUTO_COMPLETE_HOURS = 24; // requester says they paid, runner never answers: completed
export const MAX_CODE_ATTEMPTS = 5; // wrong handoff codes before the runner has to use "I got paid"
export const DISPUTE_WINDOW_HOURS = 24; // requester can report a problem this long after completion

export type PayMethod = "venmo" | "zelle";
export const PAY_METHOD_LABEL: Record<PayMethod, string> = { venmo: "Venmo", zelle: "Zelle" };

// Launch stores and drop-off areas, with rough coordinates for the fee's distance.
export const STORES = [
  { id: "target-shattuck", name: "Target", where: "Shattuck", lat: 37.8699, lng: -122.2681 },
  { id: "trader-joes-shattuck", name: "Trader Joe's", where: "Shattuck", lat: 37.8718, lng: -122.2732 },
  { id: "walgreens-telegraph", name: "Walgreens", where: "Telegraph", lat: 37.8679, lng: -122.2589 },
  { id: "safeway-shattuck", name: "Safeway", where: "Shattuck", lat: 37.8805, lng: -122.2693 },
  { id: "bear-market-cafe3", name: "Bear Market", where: "Cafe 3", lat: 37.8676, lng: -122.2601 },
  { id: "cvs-telegraph", name: "CVS", where: "Telegraph", lat: 37.8685, lng: -122.2590 },
] as const;

export type Store = (typeof STORES)[number];
export type StoreId = Store["id"];

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

// Drop-off locations, grouped for the pickers. Each has rough coordinates for
// the fee's distance (approximate: good to a block or so).
type Spot = { name: string; lat: number; lng: number };

export const DROPOFF_GROUPS: { name: string; spots: Spot[] }[] = [
  {
    name: "Residence halls",
    spots: [
      { name: "Unit 1", lat: 37.8673, lng: -122.2547 },
      { name: "Unit 2", lat: 37.8659, lng: -122.2551 },
      { name: "Unit 3", lat: 37.8669, lng: -122.261 },
      { name: "Blackwell Hall", lat: 37.8686, lng: -122.2622 },
      { name: "Martinez Commons", lat: 37.8661, lng: -122.2563 },
      { name: "Anchor House", lat: 37.8679, lng: -122.265 },
      { name: "Foothill", lat: 37.8755, lng: -122.256 },
      { name: "Stern Hall", lat: 37.8762, lng: -122.2585 },
      { name: "Bowles Hall", lat: 37.8727, lng: -122.253 },
      { name: "Clark Kerr", lat: 37.8641, lng: -122.249 },
    ],
  },
  {
    name: "Apartments & neighborhoods",
    spots: [
      { name: "Southside apartments", lat: 37.8665, lng: -122.2585 },
      { name: "Northside apartments", lat: 37.8765, lng: -122.2605 },
      { name: "Downtown apartments", lat: 37.8705, lng: -122.2685 },
      { name: "Elmwood / Clark Kerr area", lat: 37.86, lng: -122.2525 },
    ],
  },
  {
    name: "Campus spots",
    spots: [
      { name: "Sproul Plaza", lat: 37.8694, lng: -122.2591 },
      { name: "MLK Student Union", lat: 37.869, lng: -122.2597 },
      { name: "Moffitt Library", lat: 37.8726, lng: -122.2608 },
      { name: "Doe Library", lat: 37.8722, lng: -122.2594 },
      { name: "Memorial Glade", lat: 37.8729, lng: -122.2592 },
      { name: "Crossroads", lat: 37.8667, lng: -122.2563 },
      { name: "Cafe 3", lat: 37.8675, lng: -122.2602 },
    ],
  },
];

/** Every drop-off location, in picker order. */
export const LAUNCH_ZONES = DROPOFF_GROUPS.flatMap((g) => g.spots.map((s) => s.name));

export const ZONE_COORDS: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  DROPOFF_GROUPS.flatMap((g) => g.spots.map((s) => [s.name, { lat: s.lat, lng: s.lng }])),
);

// "Where you live", asked at sign-up: the halls and apartment areas above,
// plus a catch-all. It becomes the default drop-off when it's one of them.
export const DORMS = [...DROPOFF_GROUPS[0].spots, ...DROPOFF_GROUPS[1].spots].map((s) => s.name).concat("Off-campus");

export const DURATIONS = [
  { label: "1 hr", hours: 1 },
  { label: "2 hrs", hours: 2 },
  { label: "3 hrs", hours: 3 },
  { label: "6 hrs", hours: 6 },
  { label: "12 hrs", hours: 12 },
  { label: "1 day", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "6 days", hours: 144 },
];
export const MAX_DURATION_HOURS = 144; // plan: requests last 6 days at most

// The clock starts the moment a runner claims (accepts) an order: they have this long to buy and hand off the order.
// Not bought in time: the claim is released back to the shopping list.
// Bought but late: both sides are notified and the team sees it on /admin.
export const DELIVERY_WINDOW_MINUTES = 45;
export const DELIVERY_WARNING_MINUTES = 10; // "10 minutes left" push

// ETAs must fit inside the delivery window.
export const ETA_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "25 min", minutes: 25 },
  { label: "35 min", minutes: 35 },
  { label: "45 min", minutes: 45 },
];

// Restricted items (plan section 2). A keyword screen plus a required checkbox;
// photo review catches the rest.
const RESTRICTED_WORDS = [
  "alcohol", "beer", "beers", "wine", "wines", "vodka", "tequila", "whiskey", "whisky", "rum",
  "gin", "liquor", "seltzer", "white claw", "hard cider", "champagne", "soju",
  "tobacco", "cigarette", "cigarettes", "cigar", "cigars", "cigarillo", "juul", "vape", "vapes",
  "vaping", "nicotine", "zyn", "zyns", "chew", "snus", "puff bar", "elf bar",
  "prescription", "rx", "adderall", "xanax", "oxy", "oxycodone",
  "cbd", "thc", "weed", "cannabis", "marijuana", "edible", "edibles", "kratom",
  "lottery", "scratcher", "scratchers", "21+", "18+",
];
const RESTRICTED_RE = new RegExp(
  `(^|[^a-z0-9])(${RESTRICTED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^a-z0-9])`,
  "i",
);

export function findRestricted(text: string): string | null {
  const m = text.match(RESTRICTED_RE);
  return m ? m[2] : null;
}
