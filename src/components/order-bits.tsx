import clsx from "clsx";
import { getStore } from "@/lib/config";
import { breakdown } from "@/lib/fees";
import { money } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";

export function StoreAvatar({ storeId, size = 44 }: { storeId: string; size?: number }) {
  const store = getStore(storeId);
  const letters = (store?.name ?? "?").replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-lime-100 font-extrabold text-lime-900"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      {letters}
    </span>
  );
}

export function storeLabel(storeId: string) {
  const s = getStore(storeId);
  return s ? `${s.name} · ${s.where}` : storeId;
}

type Perspective = "requester" | "runner";

const LABELS: Record<RequestStatus, Record<Perspective, string>> = {
  open: { requester: "Waiting for a runner", runner: "Open" },
  claimed: { requester: "Runner claimed it", runner: "Go buy it" },
  purchased: { requester: "Bought", runner: "Snap a photo" },
  delivering: { requester: "On the way", runner: "Deliver" },
  dropped_off: { requester: "Left at drop-off", runner: "Dropped off" },
  completed: { requester: "Delivered", runner: "Done" },
  cancelled: { requester: "Cancelled", runner: "Cancelled" },
  expired: { requester: "Closed · not charged", runner: "Closed" },
  disputed: { requester: "Under review", runner: "Under review" },
  refunded: { requester: "Refunded", runner: "Refunded" },
};

const ACTIVE: RequestStatus[] = ["claimed", "purchased", "delivering", "dropped_off"];

export function StatusPill({ status, as }: { status: RequestStatus; as: Perspective }) {
  const tone = ACTIVE.includes(status)
    ? "bg-action-soft text-action-ink"
    : status === "open"
      ? "bg-lime-100 text-lime-900"
      : status === "completed"
        ? "bg-lime-50 text-lime-700"
        : status === "disputed"
          ? "bg-warn-soft text-warn-ink"
          : "bg-zinc-100 text-zinc-600";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", tone)}>
      {ACTIVE.includes(status) || status === "open" ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {LABELS[status][as]}
    </span>
  );
}

export function PriceBreakdown({
  itemsCents,
  runnerFeeCents,
  dartFeeCents,
  itemsLabel = "Items, receipt total",
  totalLabel = "You pay",
}: {
  itemsCents: number;
  runnerFeeCents?: number;
  dartFeeCents?: number;
  itemsLabel?: string;
  totalLabel?: string;
}) {
  const b = breakdown(itemsCents, runnerFeeCents, dartFeeCents);
  const rows = [
    [itemsLabel, b.itemsCents],
    ["Runner fee", b.runnerFeeCents],
    ["Dart fee", b.dartFeeCents],
    ["Card processing", b.processingCents],
  ] as const;
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-muted">
          <dt>{k}</dt>
          <dd className="tabular-nums">{money(v)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
        <dt>{totalLabel}</dt>
        <dd className="tabular-nums">{money(b.totalCents)}</dd>
      </div>
    </dl>
  );
}
