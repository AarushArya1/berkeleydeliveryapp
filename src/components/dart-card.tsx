import clsx from "clsx";
import { CreditCard, Lock, ShoppingBag, Store, Wifi } from "lucide-react";
import { money } from "@/lib/format";
import type { Card, CardLoad } from "@/lib/types";

/** The runner's one Dart virtual card, with whatever orders are on it right now. */
export function DartCardVisual({
  card,
  loads,
  className,
}: {
  card: Pick<Card, "status" | "last4" | "exp">;
  loads: Pick<CardLoad, "amount_cents">[];
  className?: string;
}) {
  const loaded = card.status === "active" && loads.length > 0;
  const total = loads.reduce((sum, l) => sum + l.amount_cents, 0);
  const label =
    card.status === "frozen"
      ? "Frozen"
      : loaded
        ? `${loads.length} order${loads.length === 1 ? "" : "s"} · up to ${money(total)}`
        : "Locked · $0";
  return (
    <div
      className={clsx(
        "relative aspect-[1.6] overflow-hidden rounded-3xl p-5 text-white shadow-float",
        loaded ? "bg-gradient-to-br from-action via-[#7d52f5] to-[#4c22c9]" : "bg-gradient-to-br from-zinc-500 to-zinc-700",
        className,
      )}
    >
      <div className="absolute -right-10 -top-12 size-44 rounded-full bg-lime-300/25" />
      <div className="absolute -bottom-16 -left-8 size-40 rounded-full bg-lime-300/15" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-lg font-extrabold tracking-tight">dart</span>
          {loaded ? <Wifi className="size-6 rotate-90 opacity-80" /> : <Lock className="size-5 opacity-80" />}
        </div>
        <div>
          <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• {card.last4}</p>
          <div className="mt-2 flex items-end justify-between text-xs">
            <span className="opacity-80">EXP {card.exp}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 font-bold">{label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const RULES = [
  { icon: Lock, title: "Locked with $0 until you claim", body: "Your card holds no money and can't be used on its own." },
  { icon: CreditCard, title: "Each claim loads it for that order", body: "Up to the requester's max price. Dart pays; you never spend your own money. Claim several orders and each gets its own load." },
  { icon: Store, title: "One store, one limit, one purchase per order", body: "Tap at the order's store and it pays for that order, up to its limit, once. Two orders at the same store? Pick which one you're paying for first." },
  { icon: ShoppingBag, title: "Then that order comes off the card", body: "Once you pay (or it's cancelled, released or runs out of time). With no orders on it, the card is locked." },
] as const;

/** How the Dart card works, shown at runner sign-up. */
export function DartCardRules({ className }: { className?: string }) {
  return (
    <ul className={clsx("space-y-3", className)}>
      {RULES.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action-soft text-action">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-[15px] font-bold leading-tight">{title}</p>
            <p className="text-sm text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
