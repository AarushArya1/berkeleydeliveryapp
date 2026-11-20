"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ChevronDown, HandCoins, Lock, Minus, Plus } from "lucide-react";
import { postRequest } from "@/app/actions";
import { PriceBreakdown } from "@/components/order-bits";
import { Button, Card, Checkbox, Chip, ErrorText, Input, Label, Notice, Select, Textarea } from "@/components/ui";
import { DROPOFF_GROUPS, DURATIONS, LIMITS, PAY_METHOD_LABEL, STORES, findRestricted, type PayMethod } from "@/lib/config";
import { quote } from "@/lib/fees";
import { money } from "@/lib/format";

const MIN = LIMITS.minOrderCents / 100;
const MAX = LIMITS.launchMaxCents / 100;

export function NewRequestForm({
  defaultZone,
  defaultSpot,
  payMethods,
}: {
  defaultZone: string;
  defaultSpot: string;
  /** How this requester can pay (from their profile). */
  payMethods: PayMethod[];
}) {
  const [items, setItems] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [store, setStore] = useState<string>("");
  const [maxDollars, setMaxDollars] = useState(20);
  const [zone, setZone] = useState(defaultZone);
  const [spot, setSpot] = useState(defaultSpot);
  const [hours, setHours] = useState(3);
  const [ack, setAck] = useState(false);
  const [payAck, setPayAck] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const restricted = useMemo(() => findRestricted(`${items}\n${notes}`), [items, notes]);
  const fee = store && zone ? quote(maxDollars * 100, store, zone) : null;
  const ready = items.trim().length >= 3 && store && zone && spot.trim().length >= 2 && ack && payAck && !restricted;
  const methods = payMethods.map((m) => PAY_METHOD_LABEL[m]).join(" or ");

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
        payAck,
      });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="px-4 pb-40 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Add to your shopping list</h1>
      <p className="mt-1 text-muted">Takes 20 seconds. Pay your runner what it cost, plus their fee, when it arrives.</p>

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
          <Label>Store</Label>
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
              The most your runner can spend on items. You pay back the actual receipt total, not this. Higher maxes pay your runner a
              little more, since they front the money.
            </p>
          </Card>
        </section>

        <section>
          <Label htmlFor="zone">Drop-off</Label>
          <Select id="zone" value={zone} onChange={(e) => setZone(e.target.value)}>
            {DROPOFF_GROUPS.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.spots.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
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
          <p className="mt-2 text-xs text-muted">If nobody picks it up by then, it just closes. You don&apos;t owe anything.</p>
        </section>

        <section className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
            <HandCoins className="mt-0.5 size-5 shrink-0 text-action" />
            <p className="text-sm leading-relaxed">
              <b>Pay at handoff with {methods}.</b> Your runner buys it with their own money. When you get your items, you pay them the
              receipt total plus the runner fee{fee ? ` (about ${money(fee.runnerFeeCents)})` : ""}. Once they upload the receipt, you&apos;re told the
              exact amount.
            </p>
          </div>
          <Checkbox
            checked={payAck}
            onChange={(e) => setPayAck(e.target.checked)}
            label={
              <>
                I&apos;ll pay my runner at handoff. <span className="text-muted">Not paying, or cancelling after it&apos;s bought without
                paying, gets my account banned.</span>
              </>
            }
          />
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
          {showBreakdown && fee ? (
            <div className="animate-rise px-1 pb-3 pt-1">
              <PriceBreakdown itemsCents={maxDollars * 100} runnerFeeCents={fee.runnerFeeCents} miles={fee.miles} estimate itemsLabel="Items (at most)" totalLabel="At most, at handoff" />
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowBreakdown((v) => !v)} disabled={!fee} className="min-w-0 flex-1 pl-1 text-left">
              <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                {fee ? (
                  <>
                    Runner fee ~{money(fee.runnerFeeCents)} <ChevronDown className={clsx("size-3.5 transition-transform", showBreakdown && "rotate-180")} />
                  </>
                ) : (
                  "Pick a store to see the fee"
                )}
              </p>
              <p className="text-xl font-extrabold tabular-nums">{fee ? `≤ ${money(maxDollars * 100 + fee.runnerFeeCents)}` : "—"}</p>
            </button>
            <Button type="submit" size="lg" loading={pending} disabled={!ready} className="px-7">
              Post request
            </Button>
          </div>
        </Card>
      </div>

      <Notice className="mt-6">
        The runner fee is set by Dart from how far your runner carries it ({fee ? `about ${fee.miles} mi` : "store to your dorm"}) and the
        item price. The amount shown is an estimate from your max; the final fee uses the real receipt total. Dart takes no cut. Cancel free until your items are bought; after that you owe the full amount.
      </Notice>
    </form>
  );
}
