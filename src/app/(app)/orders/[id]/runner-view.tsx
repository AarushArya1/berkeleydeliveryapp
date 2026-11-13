"use client";

import { useState } from "react";
import { Camera, CheckCircle2, CircleX, Clock, KeyRound, PartyPopper } from "lucide-react";
import { armForPayment, cardTap, enterCode, markPurchased, releaseClaim, submitDropoff } from "@/app/actions";
import { DeliveryCountdown } from "@/components/delivery-countdown";
import { StatusPill } from "@/components/order-bits";
import { PhotoCapture } from "@/components/photo-capture";
import { RateForm, StarsShown } from "@/components/stars";
import { Timeline } from "@/components/timeline";
import { ClockTime } from "@/components/time-left";
import { DartCardVisual } from "@/components/dart-card";
import { Button, Card, ErrorText, Input, Label, Notice, Placeholder, Select } from "@/components/ui";
import { MAX_CODE_ATTEMPTS, STORES, getStore } from "@/lib/config";
import { dollarsToCents, firstName, money } from "@/lib/format";
import type { Card as DartCard, CardAuthorization, CardLoad, DartRequest, Dispute } from "@/lib/types";
import { BackLink, ConfirmButton, ItemsCard, OrderHeader, PersonRow, PhotoCard, useAction } from "./bits";
import type { Counterpart } from "./page";

type Props = {
  req: DartRequest;
  spot: string | null;
  counterpart: Counterpart;
  itemsPhoto: string | null;
  dropoffPhoto: string | null;
  dispute: Dispute | null;
  myRating: number | null;
  card: DartCard | null;
  /** Every order on the runner's card right now (this one and any others). */
  loads: CardLoad[];
  /** The order the next tap is pointed at, when two are at the same store. */
  armedRequestId: string | null;
  auths: CardAuthorization[];
};

export function RunnerView(p: Props) {
  const { req } = p;
  const requester = firstName(p.counterpart?.name);

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <BackLink href="/run/jobs" label="My runs" />
        <StatusPill status={req.status} as="runner" />
      </div>
      <OrderHeader req={req} />
      {req.deliver_by && ["claimed", "purchased", "delivering"].includes(req.status) ? (
        <DeliveryCountdown deliverBy={req.deliver_by} bought={req.status !== "claimed"} />
      ) : null}
      <Card className="px-2 py-4">
        <Timeline status={req.status} before={req.status_before_dispute} />
      </Card>

      {req.status === "claimed" ? <BuyStep {...p} /> : null}
      {req.status === "purchased" ? <PhotoStep req={req} /> : null}
      {req.status === "delivering" || req.status === "dropped_off" ? <HandoffStep {...p} /> : null}
      {req.status === "completed" ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <PartyPopper className="size-7 text-action" />
            <div>
              <p className="text-lg font-extrabold">You earned {money(req.runner_fee_cents)}</p>
              <p className="text-sm text-muted">Arrives with your next daily payout, usually in 1–2 business days.</p>
            </div>
          </div>
          {p.myRating ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              You rated {requester} <StarsShown value={p.myRating} />
            </p>
          ) : (
            <RateForm requestId={req.id} who={requester} />
          )}
        </Card>
      ) : null}
      {req.status === "cancelled" ? (
        <Notice tone={req.cancelled_stage === "after_purchase" ? "lime" : "warn"}>
          {req.cancelled_stage === "after_purchase"
            ? `${requester} cancelled after you bought the items. They paid in full and your ${money(req.runner_fee_cents)} fee is released. You don't need to deliver.`
            : `${requester} cancelled before you bought anything. It's been taken off your Dart card. Nothing else to do.`}
        </Notice>
      ) : null}
      {req.status === "disputed" ? (
        <Notice tone="warn">
          {requester} reported a problem{p.dispute ? ` (${p.dispute.reason.toLowerCase()})` : ""}. The Dart team is reviewing it; your fee is on hold
          until then.
        </Notice>
      ) : null}
      {req.status === "refunded" ? <Notice tone="warn">This order was refunded after review.</Notice> : null}

      <Card className="p-4">
        <PersonRow
          label="Requester"
          person={p.counterpart}
          extra={req.eta_at && ["claimed", "purchased", "delivering"].includes(req.status) ? (
            <p className="text-xs text-muted">
              You said ~<ClockTime iso={req.eta_at} />
            </p>
          ) : null}
        />
      </Card>
      <ItemsCard req={req} spot={p.spot} showSpot />
      <PhotoCard src={p.itemsPhoto} caption="Items & receipt" />
      <PhotoCard src={p.dropoffPhoto} caption="Drop-off photo" />

      {req.status === "claimed" ? <ReleaseButton requestId={req.id} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: pay with the Dart card
// ---------------------------------------------------------------------------

function BuyStep({ req, card, loads, armedRequestId, auths }: Props) {
  const store = getStore(req.store);
  const storeName = store ? `${store.name} ${store.where}` : "this order's store";
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState<string>(req.store);
  const { pending, error, run } = useAction();
  const arm = useAction();
  const [last, setLast] = useState<{ approved: boolean; reason?: string; requestId: string | null } | null>(null);

  if (!card) return null;
  const cents = dollarsToCents(amount);
  const onCard = loads.some((l) => l.request_id === req.id);
  const sameStore = loads.filter((l) => l.store === req.store).length;
  const others = loads.length - (onCard ? 1 : 0);

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-lg font-extrabold">Pay with your Dart card</p>
        <p className="text-sm text-muted">
          {onCard ? (
            <>
              This order is on your card: up to {money(req.max_price_cents)}, only at {storeName}, for one purchase. Tap it at checkout
              (it&apos;s in Apple Pay or Google Pay).
              {others > 0 ? ` Your ${others} other order${others === 1 ? " is" : "s are"} on the same card, each with its own limit.` : ""}
            </>
          ) : (
            "This order isn't on your Dart card, so taps will decline. Release it and claim it again, or contact the Dart team."
          )}
        </p>
      </div>
      <DartCardVisual card={card} loads={loads} />

      {onCard && sameStore > 1 ? (
        armedRequestId === req.id ? (
          <Notice tone="lime">Your next tap at {storeName} pays for this order.</Notice>
        ) : (
          <div className="space-y-2.5 rounded-2xl bg-warn-soft p-4 text-sm text-warn-ink">
            <p>
              <b>You have {sameStore} orders at {storeName}.</b> Your card can&apos;t tell them apart at checkout, so pick this one before you
              pay for it.
            </p>
            <ErrorText>{arm.error}</ErrorText>
            <Button full variant="secondary" loading={arm.pending} onClick={() => arm.run(() => armForPayment(req.id))}>
              I&apos;m paying for this one
            </Button>
          </div>
        )
      ) : null}

      <div className="space-y-3 rounded-2xl border border-dashed border-action/30 bg-action-soft/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-action-ink">Simulate tapping at checkout</p>
          <Placeholder>Stripe Issuing</Placeholder>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label htmlFor="amt">Receipt total</Label>
            <Input id="amt" inputMode="decimal" placeholder="12.40" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="merchant">Store</Label>
            <Select id="merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)}>
              {STORES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="other">Other (e.g. a restaurant)</option>
            </Select>
          </div>
        </div>
        {last && !last.approved ? (
          <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger">
            <CircleX className="size-4 shrink-0" /> Declined: {last.reason}
          </p>
        ) : null}
        {last?.approved && last.requestId !== req.id ? (
          <Notice tone="action">
            Approved, but it paid for your other order at this store.{" "}
            <a href={`/orders/${last.requestId}`} className="font-bold underline">
              Open that order
            </a>
          </Notice>
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Button
          full
          size="lg"
          loading={pending}
          disabled={!Number.isFinite(cents) || cents <= 0}
          onClick={() =>
            run(
              () => cardTap(cents, merchant),
              (r) => {
                const d = (r as { data?: { approved: boolean; reason?: string; requestId: string | null } }).data;
                if (d) setLast(d);
              },
            )
          }
        >
          Tap Dart card
        </Button>
        {auths.some((a) => !a.approved) ? (
          <p className="text-xs text-muted">
            {auths.filter((a) => !a.approved).length} declined attempt(s). Declined taps cost nothing and need no action.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2: photo of items + receipt
// ---------------------------------------------------------------------------

function PhotoStep({ req }: { req: DartRequest }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const { pending, error, run } = useAction();

  return (
    <Card className="space-y-4 p-4">
      <p className="flex items-center gap-2 rounded-xl bg-lime-50 px-3 py-2.5 text-sm font-bold text-lime-900">
        <CheckCircle2 className="size-5" /> Approved · {money(req.purchase_cents)} at {req.purchase_merchant}
      </p>
      <div>
        <p className="text-lg font-extrabold">Snap the items &amp; receipt</p>
        <p className="text-sm text-muted">One photo with everything in it, so the requester can see you got the right things.</p>
      </div>
      <PhotoCapture label="Take photo" onChange={setPhoto} />
      <ErrorText>{error}</ErrorText>
      <Button
        full
        size="lg"
        disabled={!photo}
        loading={pending}
        onClick={() =>
          run(() => {
            const fd = new FormData();
            fd.set("requestId", req.id);
            fd.set("photo", photo!);
            return markPurchased(fd);
          })
        }
      >
        <Camera className="size-5" /> Purchased
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3: handoff with the 4-digit code, or the no-code fallback
// ---------------------------------------------------------------------------

function HandoffStep({ req, spot, counterpart }: Props) {
  const [code, setCode] = useState("");
  const [fallback, setFallback] = useState(false);
  const { pending, error, run } = useAction();
  const who = firstName(counterpart?.name);

  return (
    <>
      {req.status === "dropped_off" && req.auto_release_at ? (
        <Notice tone="lime">
          <span className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>
              Drop-off photo sent. Your fee releases automatically at <b><ClockTime iso={req.auto_release_at} /></b> unless {who} reports a
              problem. If they show up, you can still enter their code.
            </span>
          </span>
        </Notice>
      ) : null}

      <Card className="space-y-4 p-4">
        <div>
          <p className="text-lg font-extrabold">Hand it off</p>
          <p className="text-sm text-muted">
            Meet {who} at <b className="text-ink">{spot ?? req.dropoff_zone}</b> and ask for their 4-digit code.
          </p>
        </div>
        <Input
          className="h-16 text-center text-3xl font-extrabold tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          aria-label="Handoff code"
        />
        <ErrorText>{error}</ErrorText>
        <Button full size="lg" disabled={code.length !== 4} loading={pending} onClick={() => run(() => enterCode(req.id, code))}>
          <KeyRound className="size-5" /> Complete delivery
        </Button>
        <p className="text-center text-xs text-muted">{MAX_CODE_ATTEMPTS} tries max.</p>
      </Card>

      {req.status === "delivering" ? (
        fallback ? (
          <DropoffFallback req={req} who={who} />
        ) : (
          <button type="button" onClick={() => setFallback(true)} className="w-full py-2 text-center text-sm font-semibold text-action">
            {who} not here or won&apos;t give the code?
          </button>
        )
      ) : null}
    </>
  );
}

function DropoffFallback({ req, who }: { req: DartRequest; who: string }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const { pending, error, run } = useAction();

  async function submit() {
    // One-time location reading as extra proof you were at the drop-off spot.
    const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    });
    run(() => {
      const fd = new FormData();
      fd.set("requestId", req.id);
      fd.set("photo", photo!);
      if (coords) {
        fd.set("lat", String(coords.latitude));
        fd.set("lng", String(coords.longitude));
      }
      return submitDropoff(fd);
    });
  }

  return (
    <Card className="animate-rise space-y-4 p-4">
      <div>
        <p className="font-extrabold">Leave it at the drop-off spot</p>
        <p className="text-sm text-muted">
          Take a photo of the items at the drop-off spot. Your fee releases automatically after 3 hours unless {who} reports a problem.
        </p>
      </div>
      <PhotoCapture label="Photo at drop-off spot" onChange={setPhoto} />
      <ErrorText>{error}</ErrorText>
      <Button full variant="secondary" disabled={!photo} loading={pending} onClick={submit}>
        Submit drop-off photo
      </Button>
    </Card>
  );
}

function ReleaseButton({ requestId }: { requestId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2 pt-2">
      <ConfirmButton
        variant="secondary"
        pending={pending}
        onConfirm={() => run(() => releaseClaim(requestId))}
        confirmText="The order goes back on the wishlist for someone else and comes off your Dart card."
      >
        Can&apos;t make it? Release this order
      </ConfirmButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
