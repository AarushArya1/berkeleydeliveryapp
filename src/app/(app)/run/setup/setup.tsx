"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, CreditCard, IdCard, Landmark, ShieldAlert } from "lucide-react";
import { acceptRunnerTerms, completePayoutSetup, createDartCard } from "@/app/actions";
import { DartCardRules, DartCardVisual } from "@/components/dart-card";
import { BudgetStepper } from "@/components/runner-budget";
import { Button, ButtonLink, Card, Checkbox, ErrorText, Placeholder } from "@/components/ui";
import { RUNNER_CARD_WARNING } from "@/lib/legal";
import { DELIVERY_WINDOW_MINUTES, RUNNER_BUDGET } from "@/lib/config";
import type { Card as DartCard, CardLoad } from "@/lib/types";

export function RunnerSetup({
  termsDone,
  payoutsDone,
  card,
  loads,
}: {
  termsDone: boolean;
  payoutsDone: boolean;
  card: DartCard | null;
  loads: CardLoad[];
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [budget, setBudget] = useState(RUNNER_BUDGET.defaultCents);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cardDone = Boolean(card);
  const allDone = termsDone && payoutsDone && cardDone;

  return (
    <div className="px-4 pb-8 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Become a runner</h1>
      <p className="mt-1 text-muted">Three quick steps before your first order. You&apos;ll never spend your own money.</p>

      <div className="mt-6 space-y-4">
        <Card className={clsx("p-5", termsDone && "opacity-70")}>
          <div className="flex items-center gap-3">
            <StepIcon done={termsDone}>
              <ShieldAlert className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">How your Dart card works</p>
              {termsDone ? null : <p className="text-sm text-muted">You get one virtual card. Dart loads it for each order you claim.</p>}
            </div>
          </div>
          {termsDone ? null : (
            <div className="mt-5 space-y-5">
              <DartCardRules />
              <p className="rounded-2xl bg-warn-soft p-4 text-[15px] font-medium leading-relaxed text-warn-ink">{RUNNER_CARD_WARNING}</p>
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                label="I understand and agree to only use my Dart card for the orders loaded on it."
              />
              <Button full disabled={!agreed} loading={pending} onClick={() => start(async () => void (await acceptRunnerTerms()))}>
                I agree
              </Button>
            </div>
          )}
        </Card>

        <Card className={clsx("p-5", !termsDone && "pointer-events-none opacity-50", payoutsDone && "opacity-70")}>
          <div className="flex items-center gap-3">
            <StepIcon done={payoutsDone}>
              <Landmark className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">Verify ID &amp; set up payouts</p>
              <p className="text-sm text-muted">Through Stripe: an ID check plus a bank account or debit card.</p>
            </div>
          </div>
          {termsDone && !payoutsDone ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-action/30 bg-action-soft/50 p-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-action-ink">
                  <IdCard className="size-5" /> Stripe Connect onboarding
                </span>
                <Placeholder>Placeholder</Placeholder>
              </div>
              <Button full loading={pending} onClick={() => start(async () => void (await completePayoutSetup()))}>
                Continue to Stripe
              </Button>
              <p className="text-center text-xs text-muted">Fees pay out daily and usually arrive in 1–2 business days.</p>
            </div>
          ) : null}
        </Card>

        <Card className={clsx("p-5", !(termsDone && payoutsDone) && "pointer-events-none opacity-50")}>
          <div className="flex items-center gap-3">
            <StepIcon done={cardDone}>
              <CreditCard className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">{cardDone ? "Your Dart card" : "Create your Dart card"}</p>
              <p className="text-sm text-muted">
                {cardDone ? "Each order you claim is loaded onto it." : "Your one virtual card for every run."}
              </p>
            </div>
          </div>
          {termsDone && payoutsDone ? (
            <div className="mt-4 space-y-3">
              {card ? (
                <>
                  <DartCardVisual card={card} loads={loads} />
                  <div className="flex items-center justify-between rounded-2xl border border-dashed border-action/30 bg-action-soft/50 p-3.5">
                    <span className="text-sm font-semibold text-action-ink">Add to Apple Pay / Google Pay</span>
                    <Placeholder>Stripe Issuing</Placeholder>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    It starts locked with nothing on it. Each order you claim is added with its own limit (the max price) and its own store,
                    and comes off the card right after you pay for it.
                  </p>
                  <div className="rounded-2xl border border-line p-4">
                    <p className="font-bold">Your budget</p>
                    <p className="mb-4 text-sm text-muted">
                      The most you&apos;re willing to have on your card at once, across all your orders. Dart pays, not you. You can
                      change it any time on the Run tab.
                    </p>
                    <BudgetStepper value={budget} onChange={setBudget} />
                  </div>
                  <ErrorText>{error}</ErrorText>
                  <Button
                    full
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await createDartCard(budget);
                        setError(r.ok ? null : r.error);
                      })
                    }
                  >
                    Create my Dart card
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </Card>
      </div>

      {allDone ? (
        <div className="animate-rise mt-6 space-y-3 text-center">
          <p className="text-lg font-bold">You&apos;re ready to run 🏃</p>
          <p className="text-sm text-muted">
            Heads up: from the moment you claim an order, you have {DELIVERY_WINDOW_MINUTES} minutes to buy it and hand it off.
          </p>
          <ButtonLink href="/run" full size="lg" onClick={() => router.refresh()}>
            Find orders
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

function StepIcon({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        done ? "bg-lime-300 text-lime-900" : "bg-lime-100 text-lime-700",
      )}
    >
      {done ? <Check className="size-5" strokeWidth={3} /> : children}
    </span>
  );
}
