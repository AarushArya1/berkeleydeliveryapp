"use client";

import { useState } from "react";
import { AlarmClock, BadgeCheck, CreditCard, Timer, Wallet } from "lucide-react";
import { claim } from "@/app/actions";
import { TimeLeft } from "@/components/time-left";
import { Button, ButtonLink, Card, Chip, ErrorText, Notice } from "@/components/ui";
import { DELIVERY_WINDOW_MINUTES, ETA_OPTIONS, getStore } from "@/lib/config";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";
import { BackLink, ItemsCard, OrderHeader, useAction } from "./bits";

/** A runner looking at an open request they could claim. */
export function ProspectView({
  req,
  ready,
  active,
  budgetCents,
  loadedCents,
}: {
  req: DartRequest;
  ready: boolean;
  active: boolean;
  /** The runner's budget, and how much of it the orders already on their card use. */
  budgetCents: number;
  loadedCents: number;
}) {
  const [eta, setEta] = useState<number | null>(null);
  const { pending, error, run } = useAction();
  const store = getStore(req.store);
  const open = req.status === "open" && new Date(req.expires_at) > new Date();
  const budgetLeft = Math.max(0, budgetCents - loadedCents);

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <BackLink href="/run" label="All orders" />
      <OrderHeader req={req} />
      <ItemsCard req={req} spot={null} showSpot={false} />

      <Card className="grid grid-cols-3 divide-x divide-line py-4 text-center">
        <Fact icon={<Wallet className="size-5" />} value={`+${money(req.runner_fee_cents)}`} label="You earn" />
        <Fact icon={<CreditCard className="size-5" />} value={money(req.max_price_cents)} label="Card limit" />
        <Fact icon={<Timer className="size-5" />} value={<TimeLeft iso={req.expires_at} />} label="Closes in" />
      </Card>

      <Notice tone="lime">
        Claiming adds this order to your Dart card: up to {money(req.max_price_cents)}, only at{" "}
        {store ? `${store.name} ${store.where}` : "this store"}, for one purchase. You never spend your own money.
      </Notice>

      {!open ? (
        <Notice tone="warn">This request is no longer open.</Notice>
      ) : !active ? (
        <Notice tone="warn">Your account can&apos;t claim orders right now.</Notice>
      ) : !ready ? (
        <ButtonLink href="/run/setup" full size="lg">
          <BadgeCheck className="size-5" /> Set up to run first
        </ButtonLink>
      ) : req.max_price_cents > budgetLeft ? (
        <Card className="space-y-3 p-4">
          <Notice tone="warn">
            This order could cost up to {money(req.max_price_cents)}, more than the {money(budgetLeft)} left of your{" "}
            {money(budgetCents)} budget{loadedCents > 0 ? " after the orders already on your card" : ""}.
          </Notice>
          <ButtonLink href="/run" variant="secondary" full>
            Change my budget
          </ButtonLink>
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          <div className="flex gap-3 rounded-2xl bg-warn-soft p-3.5 text-sm leading-relaxed text-warn-ink">
            <AlarmClock className="mt-0.5 size-5 shrink-0" />
            <p>
              <b>The {DELIVERY_WINDOW_MINUTES}-minute clock starts the moment you tap Claim.</b> In that time, buy the items and hand
              them off. If you haven&apos;t bought them by then, the order goes back on the shopping list. Claim when you&apos;re
              about to head to the store or already there.
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
