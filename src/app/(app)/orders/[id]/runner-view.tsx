"use client";

import { useState } from "react";
import { CheckCircle2, Download, KeyRound, PartyPopper, Receipt } from "lucide-react";
import { confirmPaid, enterCode, markPurchased, releaseClaim, reportUnpaid, submitDropoff } from "@/app/actions";
import { DeliveryCountdown } from "@/components/delivery-countdown";
import { StatusPill } from "@/components/order-bits";
import { PhotoCapture } from "@/components/photo-capture";
import { RateForm, StarsShown } from "@/components/stars";
import { Timeline } from "@/components/timeline";
import { ClockTime } from "@/components/time-left";
import { Button, Card, ErrorText, Input, Label, Notice, Textarea } from "@/components/ui";
import { MAX_CODE_ATTEMPTS, PAY_METHOD_LABEL, UNPAID_BAN_HOURS, getStore } from "@/lib/config";
import { dollarsToCents, firstName, money } from "@/lib/format";
import { runnerFeeCents } from "@/lib/fees";
import { formatZelle, owesRunner } from "@/lib/pay";
import type { DartRequest, Dispute } from "@/lib/types";
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
  receiptPhoto: string | null;
};

export function RunnerView(p: Props) {
  const { req } = p;
  const requester = firstName(p.counterpart?.name);
  const unpaidReport = req.status === "disputed" && p.dispute?.kind === "unpaid";

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <BackLink href="/run/jobs" label="My runs" />
        <StatusPill status={req.status} as="runner" />
      </div>
      <OrderHeader req={req} />
      {req.deliver_by && ["claimed", "delivering"].includes(req.status) ? (
        <DeliveryCountdown deliverBy={req.deliver_by} claimedAt={req.claimed_at} bought={req.status !== "claimed"} />
      ) : null}
      <Card className="px-2 py-4">
        <Timeline status={req.status} before={req.status_before_dispute} />
      </Card>

      {req.status === "claimed" ? <BuyStep {...p} /> : null}
      {req.status === "delivering" ? <HandoffStep {...p} /> : null}
      {req.status === "dropped_off" ? (
        <Card className="space-y-4 p-4">
          <Notice tone="lime">
            You left it at the drop-off spot. {requester} still owes you, and was told to pay now in the app.
          </Notice>
          <CollectBox req={req} counterpart={p.counterpart} />
        </Card>
      ) : null}
      {req.status === "completed" ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <PartyPopper className="size-7 text-action" />
            <div>
              <p className="text-lg font-extrabold">You earned {money(req.runner_fee_cents)}</p>
              <p className="text-sm text-muted">
                Paid back {money(req.charged_cents)}{req.paid_method ? ` on ${PAY_METHOD_LABEL[req.paid_method]}` : ""}.
              </p>
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
        req.cancelled_stage === "after_purchase" ? (
          <Card className="space-y-4 p-4">
            {owesRunner(req) ? (
              <>
                <Notice tone="warn">
                  {requester} cancelled after you bought it, so they still owe you the full amount. If they don&apos;t pay, report it and return
                  the items with your receipt.
                </Notice>
                <CollectBox req={req} counterpart={p.counterpart} />
              </>
            ) : (
              <Notice tone="lime">{requester} cancelled after you bought it, and paid you back. All settled.</Notice>
            )}
          </Card>
        ) : (
          <Notice tone="warn">
            {req.cancelled_stage === "runner_late"
              ? `You missed the delivery window, so ${requester} cancelled and owes nothing. Return the items with your receipt.`
              : `${requester} cancelled before you bought anything. Nothing else to do.`}
          </Notice>
        )
      ) : null}
      {req.status === "disputed" ? (
        unpaidReport ? (
          <Card className="space-y-4 p-4">
            <Notice tone="warn">
              You reported that {requester} didn&apos;t pay. Their account is suspended, and banned if they don&apos;t pay within {UNPAID_BAN_HOURS} hours.
              If they pay you, confirm it here.
            </Notice>
            <CollectBox req={req} counterpart={p.counterpart} />
          </Card>
        ) : (
          <Notice tone="warn">
            {requester} reported a problem{p.dispute ? ` (${p.dispute.reason.toLowerCase()})` : ""}. The Dart team is reviewing it and will
            contact you.
          </Notice>
        )
      ) : null}

      <Card className="p-4">
        <PersonRow
          label="Requester"
          person={p.counterpart}
          extra={req.eta_at && ["claimed", "delivering"].includes(req.status) ? (
            <p className="text-xs text-muted">
              You said ~<ClockTime iso={req.eta_at} />
            </p>
          ) : null}
        />
      </Card>
      <ItemsCard req={req} spot={p.spot} showSpot />
      {p.receiptPhoto ? (
        <div className="space-y-2">
          <PhotoCard src={p.receiptPhoto} caption={`Your receipt · ${money(req.purchase_cents)}`} />
          <a href={p.receiptPhoto} target="_blank" rel="noreferrer" download className="flex items-center justify-center gap-2 py-1 text-sm font-semibold text-action">
            <Download className="size-4" /> Save receipt photo
          </a>
        </div>
      ) : null}
      <PhotoCard src={p.itemsPhoto} caption="Items" />
      <PhotoCard src={p.dropoffPhoto} caption="Drop-off photo" />

      {req.status === "claimed" ? <ReleaseButton requestId={req.id} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: buy it with your own money, then snap the items + receipt
// ---------------------------------------------------------------------------

function BuyStep({ req }: Props) {
  const store = getStore(req.store);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [items, setItems] = useState<File | null>(null);
  const [total, setTotal] = useState("");
  const { pending, error, run } = useAction();
  const cents = dollarsToCents(total);
  const valid = Number.isFinite(cents) && cents > 0;
  const over = valid && cents > req.max_price_cents;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-lg font-extrabold">Buy it, then upload the receipt</p>
        <p className="text-sm text-muted">
          Pay at {store ? `${store.name} ${store.where}` : "the store"} with your own card or cash, up to{" "}
          <b className="text-ink">{money(req.max_price_cents)}</b>. Then send the receipt: the requester checks it and confirms the total.
        </p>
      </div>
      <PhotoCapture label="Photo of the receipt" maxSide={2200} onChange={setReceipt} />
      <p className="-mt-2 text-xs text-muted">Lay it flat in good light, with the store name and the total readable.</p>
      <div>
        <Label htmlFor="amt" hint={`Max ${money(req.max_price_cents)}`}>
          Total on the receipt
        </Label>
        <Input id="amt" inputMode="decimal" placeholder="12.40" value={total} onChange={(e) => setTotal(e.target.value)} />
        {over ? <p className="mt-1.5 text-sm font-medium text-danger">That&apos;s over the requester&apos;s max. They only owe up to {money(req.max_price_cents)}.</p> : null}
        {valid && !over ? (
          <p className="mt-1.5 text-sm text-muted">
            You&apos;ll be paid <b className="text-ink">{money(cents + runnerFeeCents(cents, req.distance_miles ?? 1))}</b> ({money(cents)} + your{" "}
            {money(runnerFeeCents(cents, req.distance_miles ?? 1))} fee). Enter it exactly: the requester compares it with the photo.
          </p>
        ) : null}
      </div>
      <PhotoCapture label="Photo of the items (optional)" onChange={setItems} />
      <ErrorText>{error}</ErrorText>
      <Button
        full
        size="lg"
        disabled={!receipt || !valid || over}
        loading={pending}
        onClick={() =>
          run(() => {
            const fd = new FormData();
            fd.set("requestId", req.id);
            fd.set("receipt", receipt!);
            fd.set("total", total);
            if (items) fd.set("itemsPhoto", items);
            return markPurchased(fd);
          })
        }
      >
        <Receipt className="size-5" /> Send receipt
      </Button>
      <p className="flex gap-2 rounded-xl bg-lime-50 px-3 py-2.5 text-sm text-lime-900">
        <Receipt className="mt-0.5 size-4 shrink-0" /> Keep the paper receipt until you&apos;re paid. If the requester doesn&apos;t pay, it lets you return
        the items.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2: hand it off and get paid (or the no-show fallback)
// ---------------------------------------------------------------------------

function HandoffStep({ req, spot, counterpart }: Props) {
  const [fallback, setFallback] = useState(false);
  const who = firstName(counterpart?.name);

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <p className="text-lg font-extrabold">Hand it off &amp; get paid</p>
          <p className="text-sm text-muted">
            Meet {who} at <b className="text-ink">{spot ?? req.dropoff_zone}</b>. They pay you, then give you their 4-digit code. Enter it to
            finish.
          </p>
        </div>
        <CollectBox req={req} counterpart={counterpart} />
      </Card>

      {fallback ? (
        <DropoffFallback req={req} who={who} />
      ) : (
        <button type="button" onClick={() => setFallback(true)} className="w-full py-2 text-center text-sm font-semibold text-action">
          {who} not here?
        </button>
      )}
    </>
  );
}

/** What the requester owes, how they'll pay, and the runner's "got paid" / "didn't pay" buttons. */
function CollectBox({ req, counterpart }: Pick<Props, "req" | "counterpart">) {
  const { pending, error, run } = useAction();
  const [reporting, setReporting] = useState(false);
  const who = firstName(counterpart?.name);
  const from = [
    counterpart?.venmo ? `Venmo @${counterpart.venmo}` : null,
    counterpart?.zelle ? `Zelle ${formatZelle(counterpart.zelle)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-lime-50 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-lime-700">{who} owes you</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{money(req.charged_cents)}</p>
        <p className="mt-1 text-xs text-muted">
          {money(req.purchase_cents)} receipt + {money(req.runner_fee_cents)} fee{from.length ? ` · from ${from.join(" or ")}` : ""}
        </p>
      </div>
      <p className={req.receipt_confirmed_at ? "text-center text-sm font-semibold text-lime-700" : "text-center text-sm text-muted"}>
        {req.receipt_confirmed_at ? `✓ ${who} confirmed the receipt` : `Waiting for ${who} to check the receipt and confirm the total`}
      </p>
      {req.paid_reported_at && req.paid_method ? (
        <Notice tone="action">
          {who} says they paid you on <b>{PAY_METHOD_LABEL[req.paid_method]}</b>. Check your app, then confirm.
        </Notice>
      ) : null}
      {req.status === "delivering" ? (
        <CodeEntry req={req} who={who} />
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          <Button full size="lg" variant="lime" loading={pending} onClick={() => run(() => confirmPaid(req.id))}>
            <CheckCircle2 className="size-5" /> I got paid {money(req.charged_cents)}
          </Button>
        </>
      )}
      {req.status === "disputed" ? null : reporting ? (
        <ReportUnpaid req={req} who={who} onCancel={() => setReporting(false)} />
      ) : (
        <button type="button" onClick={() => setReporting(true)} className="w-full py-1 text-center text-sm font-semibold text-danger">
          {who} didn&apos;t pay
        </button>
      )}
    </div>
  );
}

/** At handoff: once paid, the runner enters the requester's code. "I got paid" is the backup if the code won't work. */
function CodeEntry({ req, who }: { req: DartRequest; who: string }) {
  const [code, setCode] = useState("");
  const [noCode, setNoCode] = useState(false);
  const { pending, error, run } = useAction();
  const backup = useAction();

  return (
    <div className="space-y-3">
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
        <KeyRound className="size-5" /> Paid &amp; handed off
      </Button>
      <p className="text-center text-xs text-muted">Only enter it once the {money(req.charged_cents)} is in your account. {MAX_CODE_ATTEMPTS} tries max.</p>
      {noCode ? (
        <div className="animate-rise space-y-2 rounded-2xl border border-line p-3">
          <p className="text-sm text-muted">If {who} paid you but can&apos;t find their code, you can finish without it.</p>
          <ErrorText>{backup.error}</ErrorText>
          <Button full variant="secondary" loading={backup.pending} onClick={() => backup.run(() => confirmPaid(req.id))}>
            <CheckCircle2 className="size-4" /> I got paid {money(req.charged_cents)}
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => setNoCode(true)} className="w-full text-center text-sm font-semibold text-action">
          {who} paid but has no code?
        </button>
      )}
    </div>
  );
}

function ReportUnpaid({ req, who, onCancel }: { req: DartRequest; who: string; onCancel: () => void }) {
  const [details, setDetails] = useState("");
  const { pending, error, run } = useAction();
  return (
    <div className="animate-rise space-y-3 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
      <p className="text-sm leading-relaxed text-ink">
        <b>{who}&apos;s account will be suspended right away</b>, and banned if they don&apos;t pay within {UNPAID_BAN_HOURS} hours. The Dart team will
        follow up. Keep your receipt: if they never pay, you can return the items.
      </p>
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened? (optional)" maxLength={1000} className="min-h-16" />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Back
        </Button>
        <Button variant="danger" className="flex-1" loading={pending} onClick={() => run(() => reportUnpaid(req.id, details))}>
          Report
        </Button>
      </div>
    </div>
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
          Take a photo of the items at the drop-off spot. {who} still owes you the full amount and gets a no-show. Or keep the items and return
          them with your receipt if you&apos;d rather not leave them.
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
        confirmText="The order goes back on the shopping list for someone else. Releasing is free before you buy anything."
      >
        Can&apos;t make it? Release this order
      </ConfirmButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
