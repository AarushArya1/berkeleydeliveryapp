"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ChevronDown, CreditCard, Lock, Minus, Plus } from "lucide-react";
import { postRequest } from "@/app/actions";
import { PriceBreakdown } from "@/components/order-bits";
import { Button, Card, Checkbox, Chip, ErrorText, Input, Label, Notice, Placeholder, Textarea } from "@/components/ui";
import { DURATIONS, LAUNCH_ZONES, LIMITS, STORES, findRestricted } from "@/lib/config";
import { breakdown } from "@/lib/fees";
import { money } from "@/lib/format";

const MIN = LIMITS.minOrderCents / 100;
const MAX = LIMITS.launchMaxCents / 100;

export function NewRequestForm({ defaultZone, defaultSpot }: { defaultZone: string; defaultSpot: string }) {
  const [items, setItems] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [store, setStore] = useState<string>("");
  const [maxDollars, setMaxDollars] = useState(20);
  const [zone, setZone] = useState(defaultZone);
  const [spot, setSpot] = useState(defaultSpot);
  const [hours, setHours] = useState(3);
  const [ack, setAck] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const restricted = useMemo(() => findRestricted(`${items}\n${notes}`), [items, notes]);
  const hold = breakdown(maxDollars * 100);
  const ready = items.trim().length >= 3 && store && zone && spot.trim().length >= 2 && ack && !restricted;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await postRequest({
        items,
        notes,
        store,
        zone,
        spot,
        maxPriceCents: maxDollars * 100,
        durationHours: hours,
        restrictedAck: ack,
      });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="px-4 pb-40 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Add to wishlist</h1>
      <p className="mt-1 text-muted">Takes 20 seconds. You&apos;re only charged what it actually costs.</p>

      <div className="mt-6 space-y-7">
        <section>
          <Label htmlFor="items">What do you need?</Label>
          <Textarea
            id="items"
            value={items}
            onChange={(e) => setItems(e.target.value)}
            placeholder={"e.g. Oat milk (half gallon), 2 bananas, Advil 50ct"}
            maxLength={500}
            autoFocus
          />
          {restricted ? (
            <p className="mt-2 text-sm font-medium text-danger">
              &ldquo;{restricted}&rdquo; can&apos;t be requested. No alcohol, tobacco, vapes, prescription drugs or age-restricted items.
            </p>
          ) : null}
          {showNotes ? (
            <Textarea
              className="mt-3 min-h-16"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for your runner (brand swaps OK? sizes?)"
              maxLength={300}
            />
          ) : (
            <button type="button" onClick={() => setShowNotes(true)} className="mt-2 text-sm font-semibold text-action">
              + Add a note for your runner
            </button>
          )}
        </section>

        <section>
          <Label>Preferred store</Label>
          <div className="grid grid-cols-2 gap-2.5">
            {STORES.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setStore(s.id)}
                aria-pressed={store === s.id}
                className={clsx(
                  "rounded-2xl border px-3.5 py-3 text-left transition-colors",
                  store === s.id ? "border-action bg-action-soft ring-2 ring-action/20" : "border-line bg-white hover:bg-lime-25",
                )}
              >
                <p className="font-bold leading-tight">{s.name}</p>
                <p className="text-xs text-muted">{s.where}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label hint={`${money(LIMITS.minOrderCents)}–${money(LIMITS.launchMaxCents)}`}>Max item price</Label>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Lower max price"
                onClick={() => setMaxDollars((d) => Math.max(MIN, d - 1))}
                className="flex size-11 items-center justify-center rounded-full bg-lime-50 text-lime-900 active:bg-lime-100"
              >
                <Minus className="size-5" />
              </button>
              <p className="text-4xl font-extrabold tabular-nums tracking-tight">${maxDollars}</p>
              <button
                type="button"
                aria-label="Raise max price"
                onClick={() => setMaxDollars((d) => Math.min(MAX, d + 1))}
                className="flex size-11 items-center justify-center rounded-full bg-lime-50 text-lime-900 active:bg-lime-100"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <input
              type="range"
              min={MIN}
              max={MAX}
              step={1}
              value={maxDollars}
              onChange={(e) => setMaxDollars(Number(e.target.value))}
              className="mt-4 w-full accent-action"
              aria-label="Max item price"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The most your runner can spend on items. You pay the actual receipt total, not this.
            </p>
          </Card>
        </section>

        <section>
          <Label>Drop-off</Label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {LAUNCH_ZONES.map((z) => (
              <Chip key={z} selected={zone === z} onClick={() => setZone(z)}>
                {z}
              </Chip>
            ))}
          </div>
          <Input
            className="mt-3"
            value={spot}
            onChange={(e) => setSpot(e.target.value)}
            placeholder="Building & spot, e.g. Towle Hall front lobby"
            maxLength={120}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> Runners only see the area until one claims your order.
          </p>
        </section>

        <section>
          <Label>Keep it open for</Label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {DURATIONS.map((d) => (
              <Chip key={d.hours} selected={hours === d.hours} onClick={() => setHours(d.hours)}>
                {d.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">If nobody picks it up by then, the hold is released. You&apos;re never charged.</p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <CreditCard className="size-5 text-muted" /> Test card •••• 4242
            </span>
            <Placeholder>Stripe placeholder</Placeholder>
          </div>
          <Checkbox
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            label="No alcohol, tobacco, vapes, prescription drugs or other age-restricted items."
          />
          <ErrorText>{error}</ErrorText>
        </section>
      </div>

      {/* Sticky total + post */}
      <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+60px)] z-20 px-3">
        <Card className="mx-auto max-w-md p-3 shadow-[0_-4px_30px_rgb(22_32_13/0.08)]">
          {showBreakdown ? (
            <div className="animate-rise px-1 pb-3 pt-1">
              <PriceBreakdown itemsCents={maxDollars * 100} itemsLabel="Items (max)" totalLabel="Max hold" />
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="min-w-0 flex-1 pl-1 text-left">
              <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                Hold up to <ChevronDown className={clsx("size-3.5 transition-transform", showBreakdown && "rotate-180")} />
              </p>
              <p className="text-xl font-extrabold tabular-nums">{money(hold.totalCents)}</p>
            </button>
            <Button type="submit" size="lg" loading={pending} disabled={!ready} className="px-7">
              Post request
            </Button>
          </div>
        </Card>
      </div>

      <Notice className="mt-6">
        Posting places a hold of up to {money(hold.totalCents)}. When your runner buys the items you&apos;re charged the receipt total
        plus fees, and the rest is released.
      </Notice>
    </form>
  );
}
