import clsx from "clsx";
import { getStore } from "@/lib/config";
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
  purchased: { requester: "Bought", runner: "Bought" },
  delivering: { requester: "On the way · pay at handoff", runner: "Deliver & get paid" },
  dropped_off: { requester: "Left at your spot · pay now", runner: "Dropped off · awaiting pay" },
  completed: { requester: "Delivered & paid", runner: "Paid" },
  cancelled: { requester: "Cancelled", runner: "Cancelled" },
  expired: { requester: "Closed · nothing owed", runner: "Closed" },
  disputed: { requester: "Under review", runner: "Under review" },
  refunded: { requester: "Closed", runner: "Closed" },
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

/** What the requester pays the runner at handoff: items + runner fee. No other fees. */
export function PriceBreakdown({
  itemsCents,
  runnerFeeCents,
  miles,
  estimate = false,
  itemsLabel = "Items, receipt total",
  totalLabel = "You pay your runner",
}: {
  itemsCents: number;
  runnerFeeCents: number;
  miles?: number | null;
  /** Before the receipt is in, the fee is an estimate from the max price. */
  estimate?: boolean;
  itemsLabel?: string;
  totalLabel?: string;
}) {
  const rows = [
    [itemsLabel, itemsCents],
    [`${estimate ? "Runner fee, est." : "Runner fee"}${miles != null ? ` (~${miles} mi)` : ""}`, runnerFeeCents],
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
        <dd className="tabular-nums">{money(itemsCents + runnerFeeCents)}</dd>
      </div>
    </dl>
  );
}
