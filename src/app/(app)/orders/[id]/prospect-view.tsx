"use client";

import { useState } from "react";
import { AlarmClock, BadgeCheck, HandCoins, Route, ShoppingBag, Wallet } from "lucide-react";
import { claim } from "@/app/actions";
import { Button, ButtonLink, Card, Chip, ErrorText, Notice } from "@/components/ui";
import { DELIVERY_WINDOW_MINUTES, ETA_OPTIONS, PAY_METHOD_LABEL, getStore, type PayMethod } from "@/lib/config";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";
import { BackLink, ItemsCard, OrderHeader, useAction } from "./bits";

/** A runner looking at an open request they could claim. */
export function ProspectView({
  req,
  ready,
  active,
  budgetCents,
  requesterMethods,
  myMethods,
}: {
  req: DartRequest;
  ready: boolean;
  active: boolean;
  /** The most this runner will front for one order. */
  budgetCents: number;
  /** How the requester can pay, and how this runner can be paid. */
  requesterMethods: PayMethod[];
  myMethods: PayMethod[];
}) {
  const [eta, setEta] = useState<number | null>(null);
  const { pending, error, run } = useAction();
  const store = getStore(req.store);
  const open = req.status === "open" && new Date(req.expires_at) > new Date();
  const shared = requesterMethods.filter((m) => myMethods.includes(m));
  const theirs = requesterMethods.map((m) => PAY_METHOD_LABEL[m]).join(" or ");

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <BackLink href="/run" label="All orders" />
      <OrderHeader req={req} />
      <ItemsCard req={req} spot={null} showSpot={false} />

      <Card className="grid grid-cols-3 divide-x divide-line py-4 text-center">
        <Fact icon={<Wallet className="size-5" />} value={`~${money(req.runner_fee_cents)}`} label="You earn, est." />
        <Fact icon={<ShoppingBag className="size-5" />} value={money(req.max_price_cents)} label="You front, at most" />
        <Fact icon={<Route className="size-5" />} value={req.distance_miles != null ? `~${req.distance_miles} mi` : "—"} label="Store → drop-off" />
      </Card>

      <Notice tone="lime">
        <span className="flex gap-2.5">
          <HandCoins className="mt-0.5 size-4 shrink-0" />
          <span>
            You buy it at {store ? `${store.name} ${store.where}` : "the store"} with your own money (up to {money(req.max_price_cents)}) and
            send a photo of the receipt with its total. Your exact fee is set from the real price (up to {money(req.runner_fee_cents)}). The requester
            confirms the receipt, then at handoff pays you both with {theirs || "Venmo or Zelle"} and gives you their 4-digit code.
          </span>
        </span>
      </Notice>

      {!open ? (
        <Notice tone="warn">This request is no longer open.</Notice>
      ) : !active ? (
        <Notice tone="warn">Your account can&apos;t claim orders right now.</Notice>
      ) : !ready ? (
        <ButtonLink href="/run/setup" full size="lg">
          <BadgeCheck className="size-5" /> Set up to run first
        </ButtonLink>
      ) : req.max_price_cents > budgetCents ? (
        <Card className="space-y-3 p-4">
          <Notice tone="warn">
            This order could cost up to {money(req.max_price_cents)}, more than the {money(budgetCents)} you said you&apos;d front.
          </Notice>
          <ButtonLink href="/run" variant="secondary" full>
            Change my max
          </ButtonLink>
        </Card>
      ) : shared.length === 0 ? (
        <Card className="space-y-3 p-4">
          <Notice tone="warn">This requester pays with {theirs}. Add it to your profile to take this order.</Notice>
          <ButtonLink href="/profile" variant="secondary" full>
            Add {theirs}
          </ButtonLink>
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          <div className="flex gap-3 rounded-2xl bg-warn-soft p-3.5 text-sm leading-relaxed text-warn-ink">
            <AlarmClock className="mt-0.5 size-5 shrink-0" />
            <p>
              <b>The {DELIVERY_WINDOW_MINUTES}-minute clock starts the moment you tap Claim.</b> In that time, buy the items and hand
              them off. Not bought in time: it goes back on the list for someone else. Claim when you&apos;re about to head to the
              store or already there.
            </p>
          </div>
          <p className="font-bold">When will you be at {req.dropoff_zone}?</p>
          <div className="flex flex-wrap gap-2">
            {ETA_OPTIONS.map((o) => (
              <Chip key={o.minutes} selected={eta === o.minutes} onClick={() => setEta(o.minutes)}>
                ~{o.label}
              </Chip>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
          <Button full size="lg" disabled={eta == null} loading={pending} onClick={() => run(() => claim(req.id, eta!))}>
            Claim · starts {DELIVERY_WINDOW_MINUTES}-min clock
          </Button>
        </Card>
      )}
    </div>
  );
}

function Fact({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-lime-700">{icon}</span>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}
