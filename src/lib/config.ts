// Everything the plan leaves as a placeholder ($x, $y, [__]%) lives here so the
// pilot can tune it in one place.

// Values must be read as `process.env.NEXT_PUBLIC_X` literally so Next.js can
// inline them into client code.
function envCents(v: string | undefined, fallback: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const FEES = {
  // Placeholders until prices are set (plan section 6).
  runnerFeeCents: envCents(process.env.NEXT_PUBLIC_RUNNER_FEE_CENTS, 300),
  dartFeeCents: envCents(process.env.NEXT_PUBLIC_DART_FEE_CENTS, 150),
  // Card processing: 2.9% + 30¢ of items + runner fee + Dart fee.
  processingPct: 0.029,
  processingFixedCents: 30,
};

export const LIMITS = {
  minOrderCents: 1000, // $10 minimum in items
  launchMaxCents: 3000, // $30 cap at launch
};

// Share of every Dart fee that funds the refund reserve. Plan: "start with [__]%".
export const RESERVE_SHARE = 0.25;

// Trust tiers turn on after the pilot. Until then every runner is capped at $30.
export const TRUST_TIERS_ENABLED = false;
export const TRUST_TIERS = [
  { minCompleted: 0, maxCents: 3000 },
  { minCompleted: 10, maxCents: 7500 },
  { minCompleted: 30, maxCents: 15000 },
];
export const TRUST_TIER_MIN_RATING = 4.5;

export const NO_SHOW_BAN_THRESHOLD = 2; // "repeat no-shows are banned"
export const FALLBACK_RELEASE_HOURS = 3;
export const MAX_CODE_ATTEMPTS = 5;
export const DISPUTE_WINDOW_HOURS = 24; // after completion

// Store "type" drives the Dart card's real-time approval (Stripe Issuing
// merchant categories once wired up).

export const STORES = [
  { id: "target-shattuck", name: "Target", where: "Shattuck", category: "general_merchandise", color: "#E5484D" },
  { id: "trader-joes-shattuck", name: "Trader Joe's", where: "Shattuck", category: "grocery", color: "#C2410C" },
  { id: "walgreens-telegraph", name: "Walgreens", where: "Telegraph", category: "pharmacy", color: "#DC2626" },
  { id: "safeway-shattuck", name: "Safeway", where: "Shattuck", category: "grocery", color: "#B91C1C" },
  { id: "bear-market-cafe3", name: "Bear Market", where: "Cafe 3", category: "convenience", color: "#1D4ED8" },
  { id: "cvs-telegraph", name: "CVS", where: "Telegraph", category: "pharmacy", color: "#BE123C" },
] as const;

export type Store = (typeof STORES)[number];
export type StoreId = Store["id"];

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

export const CATEGORY_LABEL: Record<string, string> = {
  general_merchandise: "department stores",
  grocery: "grocery stores",
  pharmacy: "pharmacies",
  convenience: "convenience stores",
};

// Dorms asked for at sign-up. The launch area is one dorm cluster; only those
// can be drop-off areas for now.
export const DORMS = [
  "Unit 1",
  "Unit 2",
  "Unit 3",
  "Blackwell Hall",
  "Martinez Commons",
  "Foothill",
  "Stern Hall",
  "Clark Kerr",
  "Off-campus",
];

export const LAUNCH_ZONES = ["Unit 1", "Unit 2", "Unit 3", "Blackwell Hall", "Martinez Commons"];

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
export const MAX_DURATION_HOURS = 144; // card holds expire after ~7 days

// Once a runner claims, they have this long to buy and hand off the order.
// Not bought in time: the claim is released back to the wishlist.
// Bought but late: both sides are notified and the team sees it on /admin.
export const DELIVERY_WINDOW_MINUTES = 45;
export const DELIVERY_WARNING_MINUTES = 10; // "10 minutes left" push
// Two orders at the same store: "I'm paying for this one" points the next tap at it for this long.
export const ARM_MINUTES = 10;

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
