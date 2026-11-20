"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, Hourglass, PackageCheck, ShieldAlert, Sparkles } from "lucide-react";
import { cancelRequest, confirmReceived, openDispute } from "@/app/actions";
import { NotifyPrompt } from "@/components/notify-prompt";
import { PriceBreakdown, StatusPill } from "@/components/order-bits";
import { RateForm, StarsShown } from "@/components/stars";
import { Timeline } from "@/components/timeline";
import { ClockTime, TimeLeft } from "@/components/time-left";
import { Button, Card, Chip, ErrorText, Placeholder, Textarea } from "@/components/ui";
import { firstName, money } from "@/lib/format";
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
  code: string | null;
  posted: boolean;
  canDispute: boolean;
};

const IN_PROGRESS = ["claimed", "purchased", "delivering", "dropped_off"];
const DISPUTE_REASONS = ["Items damaged", "Items lost / never arrived", "Wrong items", "Other"];

export function RequesterView(p: Props) {
  const { req } = p;
  const runner = firstName(p.counterpart?.name);
  const charged = req.purchase_cents != null;

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

      <StatusHero {...p} runner={runner} />

      {p.code && IN_PROGRESS.includes(req.status) ? (
        <Card className="bg-lime-50 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Your handoff code</p>
          <p className="mt-2 font-mono text-5xl font-extrabold tracking-[0.3em] text-ink">{p.code}</p>
          <p className="mt-2 text-sm text-muted">Give this to {runner} when you get your items.</p>
        </Card>
      ) : null}

      {p.counterpart ? (
        <Card className="p-4">
          <PersonRow
            label="Your runner"
            person={p.counterpart}
            extra={req.eta_at && ["claimed", "purchased", "delivering"].includes(req.status) ? (
              <p className="text-xs text-muted">
                ETA ~<ClockTime iso={req.eta_at} />
              </p>
            ) : null}
          />
        </Card>
      ) : null}

      <PhotoCard src={p.dropoffPhoto} caption="Left at your drop-off spot" />
      <PhotoCard src={p.itemsPhoto} caption="Items & receipt" />
      <ItemsCard req={req} spot={p.spot} showSpot />

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">{charged ? "Receipt" : "Card hold"}</p>
          <Placeholder>Stripe placeholder</Placeholder>
        </div>
        {charged ? (
          <>
            <PriceBreakdown
              itemsCents={req.purchase_cents!}
              runnerFeeCents={req.runner_fee_cents}
              dartFeeCents={req.dart_fee_cents}
              itemsLabel={`Items at ${req.purchase_merchant}`}
              totalLabel={req.status === "refunded" ? "Charged (refunded after review)" : "Charged"}
            />
            <p className="text-xs text-muted">The rest of your {money(req.hold_cents)} hold was released.</p>
          </>
        ) : (
          <>
            <PriceBreakdown
              itemsCents={req.max_price_cents}
              runnerFeeCents={req.runner_fee_cents}
              dartFeeCents={req.dart_fee_cents}
              itemsLabel="Items (max)"
              totalLabel={["cancelled", "expired"].includes(req.status) ? "Hold released" : "Held, not charged"}
            />
            {["open", "claimed"].includes(req.status) ? (
              <p className="text-xs text-muted">You&apos;ll be charged the actual receipt total plus fees when your items are bought.</p>
            ) : null}
          </>
        )}
      </Card>

      <Actions {...p} runner={runner} />
    </div>
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
          Visible to verified runners nearby. Closes in <TimeLeft iso={req.expires_at} />. If nobody claims it, your hold is released.
        </>,
      );
    case "claimed":
      return hero(
        <Sparkles className="size-5" />,
        <>{runner} is on it</>,
        req.eta_at ? <>Expect them around <ClockTime iso={req.eta_at} />. You&apos;ll be notified when your items are bought.</> : null,
      );
    case "purchased":
      return hero(<PackageCheck className="size-5" />, <>Bought for {money(req.purchase_cents)}</>, `At ${req.purchase_merchant}. ${runner} is grabbing a receipt photo.`);
    case "delivering":
      return hero(<PackageCheck className="size-5" />, "On the way", "Head to your drop-off spot and have your code ready.");
    case "dropped_off":
      return hero(
        <PackageCheck className="size-5" />,
        "Left at your drop-off spot",
        req.auto_release_at ? (
          <>
            {runner} couldn&apos;t find you. If something&apos;s wrong, report it before <ClockTime iso={req.auto_release_at} />.
          </>
        ) : null,
      );
    case "completed":
      return (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-lime-500" />
            <p className="text-lg font-extrabold">Delivered. Enjoy!</p>
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
          ? "You cancelled after your items were bought, so you were charged in full and your runner was paid."
          : "Your hold was released. You weren't charged.",
      );
    case "expired":
      return hero(<CircleSlash className="size-5" />, "No runner this time", "Your request closed and the hold was released. You weren't charged.");
    case "disputed":
      return hero(
        <ShieldAlert className="size-5" />,
        "We're reviewing your report",
        dispute ? `${dispute.reason}. The Dart team will follow up soon.` : "The Dart team will follow up soon.",
      );
    case "refunded":
      return hero(<ShieldAlert className="size-5" />, "Refunded", dispute?.resolution_note ?? "Your refund was issued from the Dart reserve.");
  }
}

function Actions({ req, runner, canDispute }: Props & { runner: string }) {
  const { pending, error, run } = useAction();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const cancelText =
    req.status === "open" ? (
      "Your hold will be released. You won't be charged."
    ) : req.status === "claimed" ? (
      <>{runner} hasn&apos;t bought anything yet, so cancelling is free.</>
    ) : (
      <>
        <b>Your items were already bought.</b> You&apos;ll still be charged {money(req.charged_cents)} and {runner} keeps their fee.
      </>
    );

  return (
    <div className="space-y-3 pt-2">
      {req.status === "dropped_off" ? (
        <Button full size="lg" variant="lime" loading={pending} onClick={() => run(() => confirmReceived(req.id))}>
          <CheckCircle2 className="size-5" /> I got my items
        </Button>
      ) : null}

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

      {["open", "claimed", "purchased", "delivering", "dropped_off"].includes(req.status) ? (
        <ConfirmButton pending={pending} onConfirm={() => run(() => cancelRequest(req.id))} confirmText={cancelText}>
          {req.status === "open" ? "Cancel request" : "Cancel order"}
        </ConfirmButton>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
