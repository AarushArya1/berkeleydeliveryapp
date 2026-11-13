"use client";

import { useState } from "react";
import { AlarmClock, BadgeCheck, CreditCard, Timer, Wallet } from "lucide-react";
import { claim } from "@/app/actions";
import { TimeLeft } from "@/components/time-left";
import { Button, ButtonLink, Card, Chip, ErrorText, Notice } from "@/components/ui";
import { CATEGORY_LABEL, DELIVERY_WINDOW_MINUTES, ETA_OPTIONS, getStore } from "@/lib/config";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";
import { BackLink, ItemsCard, OrderHeader, useAction } from "./bits";

/** A runner looking at an open request they could claim. */
export function ProspectView({ req, ready, active }: { req: DartRequest; ready: boolean; active: boolean }) {
  const [eta, setEta] = useState<number | null>(null);
  const { pending, error, run } = useAction();
  const store = getStore(req.store);
  const open = req.status === "open" && new Date(req.expires_at) > new Date();

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
        Claiming creates a temporary Dart card just for this order (up to {money(req.max_price_cents)} at{" "}
        {CATEGORY_LABEL[store?.category ?? ""] ?? "this store"}). You never spend your own money.
      </Notice>

      {!open ? (
        <Notice tone="warn">This request is no longer open.</Notice>
      ) : !active ? (
        <Notice tone="warn">Your account can&apos;t claim orders right now.</Notice>
      ) : !ready ? (
        <ButtonLink href="/run/setup" full size="lg">
          <BadgeCheck className="size-5" /> Set up to run first
        </ButtonLink>
      ) : (
        <Card className="space-y-4 p-4">
          <div className="flex gap-3 rounded-2xl bg-warn-soft p-3.5 text-sm leading-relaxed text-warn-ink">
            <AlarmClock className="mt-0.5 size-5 shrink-0" />
            <p>
              <b>You&apos;ll have {DELIVERY_WINDOW_MINUTES} minutes</b> from claiming to buy the items and hand them off. If you
              haven&apos;t bought them by then, the order goes back on the wishlist. Only claim when you&apos;re heading to the store.
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
            Claim · {DELIVERY_WINDOW_MINUTES} min to deliver
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
