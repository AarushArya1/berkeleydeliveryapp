"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, Copy, HandCoins, Hourglass, PackageCheck, ShieldAlert, Sparkles } from "lucide-react";
import { cancelRequest, confirmReceipt, openDispute, reportPaid } from "@/app/actions";
import { NotifyPrompt } from "@/components/notify-prompt";
import { PriceBreakdown, StatusPill } from "@/components/order-bits";
import { RateForm, StarsShown } from "@/components/stars";
import { Timeline } from "@/components/timeline";
import { ClockTime, TimeLeft } from "@/components/time-left";
import { Button, Card, Chip, ErrorText, Notice, Textarea } from "@/components/ui";
import { PAY_METHOD_LABEL, UNPAID_BAN_HOURS, type PayMethod } from "@/lib/config";
import { firstName, money } from "@/lib/format";
import { formatZelle, owesRunner, venmoPayUrl } from "@/lib/pay";
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
  /** 4-digit handoff code: given to the runner after paying. */
  code: string | null;
  posted: boolean;
  canDispute: boolean;
};

const DISPUTE_REASONS = ["Receipt doesn't match", "Wrong or missing items", "Items damaged", "Asked for more than the receipt", "Runner never showed up", "Other"];

export function RequesterView(p: Props) {
  const { req } = p;
  const runner = firstName(p.counterpart?.name);
  const owes = owesRunner(req);
  const unpaidReport = req.status === "disputed" && p.dispute?.kind === "unpaid";

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <BackLink href="/wishlist" label="Shopping list" />
        <StatusPill status={req.status} as="requester" />
      </div>

      {["open", "claimed"].includes(req.status) ? <NotifyPrompt posted={p.posted && req.status === "open"} /> : null}

      <OrderHeader req={req} />
      {req.status !== "cancelled" && req.status !== "expired" ? (
        <Card className="px-2 py-4">
          <Timeline status={req.status} before={req.status_before_dispute} />
        </Card>
      ) : null}

      {unpaidReport ? (
        <Notice tone="warn">
          <b>{runner} reported that you haven&apos;t paid.</b> Your account is suspended. Pay {money(req.charged_cents)} within{" "}
          {UNPAID_BAN_HOURS} hours of the report or your account will be banned and Dart will help {runner} recover the money.
        </Notice>
      ) : (
        <StatusHero {...p} runner={runner} />
      )}

      {owes && p.counterpart ? <PayCard req={req} runner={p.counterpart} receiptPhoto={p.receiptPhoto} /> : null}

      {p.code && ["claimed", "delivering"].includes(req.status) ? (
        <Card className="bg-lime-50 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Your handoff code</p>
          <p className="mt-2 font-mono text-5xl font-extrabold tracking-[0.3em] text-ink">{p.code}</p>
          <p className="mt-2 text-sm text-muted">
            {req.status === "claimed" ? "At handoff, pay first, then give this to " : "Pay first, then give this to "}
            {runner}. It confirms you got your items and paid.
          </p>
        </Card>
      ) : null}

      {p.counterpart ? (
        <Card className="p-4">
          <PersonRow
            label="Your runner"
            person={p.counterpart}
            extra={req.eta_at && ["claimed", "delivering"].includes(req.status) ? (
              <p className="text-xs text-muted">
                ETA ~<ClockTime iso={req.eta_at} />
              </p>
            ) : null}
          />
        </Card>
      ) : null}

      <PhotoCard src={p.dropoffPhoto} caption="Left at your drop-off spot" />
      {req.receipt_confirmed_at || !owes ? <PhotoCard src={p.receiptPhoto} caption={`Receipt · ${money(req.purchase_cents)}`} /> : null}
      <PhotoCard src={p.itemsPhoto} caption="Your items" />
      <ItemsCard req={req} spot={p.spot} showSpot />

      {req.charged_cents == null && ["open", "claimed"].includes(req.status) ? (
        <Card className="space-y-3 p-4">
          <p className="font-bold">What you&apos;ll pay at handoff</p>
          <PriceBreakdown
            itemsCents={req.max_price_cents}
            runnerFeeCents={req.runner_fee_cents}
            miles={req.distance_miles}
            estimate
            itemsLabel="Items (at most)"
            totalLabel="At most"
          />
          <p className="text-xs text-muted">
            Right after buying, your runner sends you a photo of the receipt and its total. The fee is then set from the real price, so
            it&apos;s usually a little lower. You check the receipt, then pay by Venmo or Zelle at handoff.
          </p>
        </Card>
      ) : null}

      <Actions {...p} runner={runner} />
    </div>
  );
}

/** Step before paying: the requester compares the receipt photo with the total the runner entered. */
function ReceiptCheck({ req, who, receiptPhoto }: { req: DartRequest; who: string; receiptPhoto: string | null }) {
  const { pending, error, run } = useAction();
  const [mismatch, setMismatch] = useState(false);
  const [details, setDetails] = useState("");

  return (
    <div className="space-y-3">
      {receiptPhoto ? (
        <a href={receiptPhoto} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptPhoto} alt="Receipt" className="max-h-96 w-full bg-lime-25 object-contain" />
          <span className="block px-3 py-2 text-center text-xs font-semibold text-action">Tap to zoom</span>
        </a>
      ) : null}
      <p className="text-sm leading-relaxed">
        {who} entered <b>{money(req.purchase_cents)}</b> as the receipt total. Check it matches the photo before you pay.
      </p>
      <ErrorText>{error}</ErrorText>
      {mismatch ? (
        <div className="animate-rise space-y-3 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
          <p className="text-sm text-ink">The Dart team will look at the receipt and sort it out with you both. Don&apos;t pay until then.</p>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What's different? (optional)" maxLength={1000} className="min-h-16" />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setMismatch(false)}>
              Back
            </Button>
            <Button variant="danger" className="flex-1" loading={pending} onClick={() => run(() => openDispute(req.id, "Receipt doesn't match", details))}>
              Report
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setMismatch(true)}>
            Doesn&apos;t match
          </Button>
          <Button className="flex-1" loading={pending} onClick={() => run(() => confirmReceipt(req.id))}>
            <CheckCircle2 className="size-4" /> Matches
          </Button>
        </div>
      )}
    </div>
  );
}

/** Pay the runner: the amount, their Venmo / Zelle, and "I've paid". */
function PayCard({ req, runner, receiptPhoto }: { req: DartRequest; runner: NonNullable<Counterpart>; receiptPhoto: string | null }) {
  const who = firstName(runner.name);
  const { pending, error, run } = useAction();
  const [copied, setCopied] = useState(false);
  const note = `Dart: ${req.items.replace(/\s+/g, " ").slice(0, 40)}`;
  const reported = Boolean(req.paid_reported_at);
  const methods: PayMethod[] = [...(runner.venmo ? (["venmo"] as const) : []), ...(runner.zelle ? (["zelle"] as const) : [])];

  return (
    <Card className="space-y-4 border-action/25 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action-soft text-action">
          <HandCoins className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {reported ? "You paid" : req.receipt_confirmed_at ? `Pay ${who}` : "Check your receipt"}
          </p>
          <p className="text-3xl font-extrabold tabular-nums">{money(req.charged_cents)}</p>
        </div>
      </div>
      <PriceBreakdown itemsCents={req.purchase_cents!} runnerFeeCents={req.runner_fee_cents} totalLabel="Total" />
      {!req.receipt_confirmed_at ? (
        <ReceiptCheck req={req} who={who} receiptPhoto={receiptPhoto} />
      ) : reported ? (
        <Notice tone="lime">
          You said you paid on {req.paid_method ? PAY_METHOD_LABEL[req.paid_method] : "Venmo or Zelle"}. Waiting for {who} to confirm.
        </Notice>
      ) : (
        <>
          {req.status === "delivering" ? (
            <p className="text-sm text-muted">When {who} arrives: pay here, then give them your 4-digit code below.</p>
          ) : null}
          <div className="space-y-2.5">
            {runner.venmo ? (
              <a
                href={venmoPayUrl(runner.venmo, req.charged_cents!, note)}
                target="_blank"
                rel="noreferrer"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#008CFF] text-base font-bold text-white"
              >
                Pay {money(req.charged_cents)} on Venmo · @{runner.venmo}
              </a>
            ) : null}
            {runner.zelle ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(runner.zelle!).then(() => setCopied(true), () => {});
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#6D1ED4]">Zelle</span>
                  <span className="font-bold">{formatZelle(runner.zelle)}</span>
                  <span className="block text-xs text-muted">Send {money(req.charged_cents)} from your bank&apos;s app</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-action">
                  <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
                </span>
              </button>
            ) : null}
          </div>
          <div className="border-t border-line pt-4">
            <p className="mb-2.5 text-sm font-bold">Paid? Let {who} know</p>
            <div className="flex gap-2">
              {methods.map((m) => (
                <Button key={m} variant="secondary" className="flex-1" loading={pending} onClick={() => run(() => reportPaid(req.id, m))}>
                  <CheckCircle2 className="size-4" /> I paid on {PAY_METHOD_LABEL[m]}
                </Button>
              ))}
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <p className="text-xs leading-relaxed text-muted">
            {who} paid for these with their own money. Not paying gets your account suspended right away, and banned after {UNPAID_BAN_HOURS}{" "}
            hours.
          </p>
        </>
      )}
    </Card>
  );
}

function StatusHero({ req, runner, dispute, myRating }: Props & { runner: string }) {
  const hero = (icon: React.ReactNode, title: React.ReactNode, body?: React.ReactNode) => (
    <Card className="flex items-start gap-3.5 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action-soft text-action">{icon}</span>
      <div>
        <p className="text-lg font-extrabold leading-snug">{title}</p>
        {body ? <div className="mt-1 text-sm leading-relaxed text-muted">{body}</div> : null}
      </div>
    </Card>
  );

  switch (req.status) {
    case "open":
      return hero(
        <Hourglass className="size-5" />,
        "Waiting for a runner",
        <>
          Visible to verified runners nearby. Closes in <TimeLeft iso={req.expires_at} />. If nobody claims it, it just closes and you owe
          nothing.
        </>,
      );
    case "claimed":
      return hero(
        <Sparkles className="size-5" />,
        <>{runner} is on it</>,
        req.eta_at ? <>Expect them around <ClockTime iso={req.eta_at} />. Have Venmo or Zelle ready for handoff.</> : null,
      );
    case "purchased":
    case "delivering":
      return hero(
        <PackageCheck className="size-5" />,
        <>Bought for {money(req.purchase_cents)} · on the way</>,
        req.receipt_confirmed_at
          ? "Head to your drop-off spot. Pay your runner when they hand you your items, then give your code."
          : "Check the receipt below and confirm the total. Then pay your runner at handoff.",
      );
    case "dropped_off":
      return hero(
        <PackageCheck className="size-5" />,
        "Left at your drop-off spot",
        <>{runner} couldn&apos;t find you. Grab your items and pay them now. This counts as a no-show.</>,
      );
    case "completed":
      return (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-lime-500" />
            <p className="text-lg font-extrabold">Delivered &amp; paid. Enjoy!</p>
          </div>
          {myRating ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              You rated {runner} <StarsShown value={myRating} />
            </p>
          ) : (
            <RateForm requestId={req.id} who={runner} />
          )}
        </Card>
      );
    case "cancelled":
      return hero(
        <CircleSlash className="size-5" />,
        "Cancelled",
        req.cancelled_stage === "after_purchase"
          ? req.completed_at
            ? "You cancelled after your items were bought, and you've paid your runner. All settled."
            : `You cancelled after your items were bought, so you still owe ${runner} the full amount.`
          : req.cancelled_stage === "runner_late"
            ? "Your runner missed the delivery window. You don't owe anything."
            : "You don't owe anything.",
      );
    case "expired":
      return hero(<CircleSlash className="size-5" />, "No runner this time", "Your request closed. You don't owe anything.");
    case "disputed":
      return hero(
        <ShieldAlert className="size-5" />,
        "We're reviewing your report",
        dispute ? `${dispute.reason}. The Dart team will follow up soon.` : "The Dart team will follow up soon.",
      );
    case "refunded":
      return hero(<ShieldAlert className="size-5" />, "Closed after review", dispute?.resolution_note ?? "The Dart team closed this order.");
  }
}

function Actions({ req, runner, canDispute }: Props & { runner: string }) {
  const { pending, error, run } = useAction();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const runnerLate = req.status === "delivering" && req.deliver_by != null && new Date(req.deliver_by) <= new Date();

  const cancelText =
    req.status === "open" ? (
      "Your request comes off the list. You don't owe anything."
    ) : req.status === "claimed" ? (
      <>{runner} hasn&apos;t bought anything yet, so cancelling is free.</>
    ) : runnerLate ? (
      <>{runner} missed the delivery window, so you can cancel and owe nothing.</>
    ) : (
      <>
        <b>{runner} already bought your items with their own money.</b> You&apos;ll still owe them {money(req.charged_cents)}. Not paying gets your
        account banned.
      </>
    );

  return (
    <div className="space-y-3 pt-2">
      {canDispute ? (
        disputing ? (
          <Card className="animate-rise space-y-4 p-4">
            <p className="font-bold">What went wrong?</p>
            <div className="flex flex-wrap gap-2">
              {DISPUTE_REASONS.map((r) => (
                <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                  {r}
                </Chip>
              ))}
            </div>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us more (optional)" maxLength={1000} />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDisputing(false)}>
                Back
              </Button>
              <Button className="flex-1" disabled={!reason} loading={pending} onClick={() => run(() => openDispute(req.id, reason, details))}>
                Report
              </Button>
            </div>
          </Card>
        ) : (
          <Button full variant="secondary" onClick={() => setDisputing(true)}>
            <ShieldAlert className="size-4" /> Report a problem
          </Button>
        )
      ) : null}

      {["open", "claimed", "delivering", "dropped_off"].includes(req.status) ? (
        <ConfirmButton pending={pending} onConfirm={() => run(() => cancelRequest(req.id))} confirmText={cancelText}>
          {req.status === "open" ? "Cancel request" : runnerLate ? "Cancel: runner is late" : "Cancel order"}
        </ConfirmButton>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
