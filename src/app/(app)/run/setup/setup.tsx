"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, HandCoins, Receipt, ShieldAlert, ShoppingBag, Timer, Wallet } from "lucide-react";
import { acceptRunnerTerms, setRunnerBudget } from "@/app/actions";
import { PayAccountsEditor } from "@/components/pay-accounts";
import { BudgetStepper } from "@/components/runner-budget";
import { Button, ButtonLink, Card, Checkbox, ErrorText } from "@/components/ui";
import { CONSEQUENCES, RUNNER_PROMISE } from "@/lib/legal";
import { DELIVERY_WINDOW_MINUTES, RUNNER_BUDGET } from "@/lib/config";
import { money } from "@/lib/format";
import { formatZelle } from "@/lib/pay";

const HOW_IT_WORKS = [
  { icon: ShoppingBag, title: "You buy it with your own money", body: "Card, Apple Pay, whatever you use. Only claim orders you're comfortable fronting." },
  { icon: Receipt, title: "Upload the receipt first", body: "Send a photo of it and its total. Your exact fee is set from the real price, and the requester checks the receipt before paying. Keep the paper receipt until you're paid, so you can return the items if you have to." },
  { icon: HandCoins, title: "Get paid, then enter their code", body: "At handoff the requester pays you the receipt total plus your fee by Venmo or Zelle, then gives you a 4-digit code. Enter it to finish." },
  { icon: Timer, title: `${DELIVERY_WINDOW_MINUTES} minutes from when you claim`, body: "To buy it and hand it off. Claim when you're about to head to the store or already there." },
] as const;

export function RunnerSetup({
  termsDone,
  venmo,
  zelle,
  budgetCents,
}: {
  termsDone: boolean;
  venmo: string | null;
  zelle: string | null;
  budgetCents: number | null;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [budget, setBudget] = useState(budgetCents ?? RUNNER_BUDGET.defaultCents);
  const [editingPay, setEditingPay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const payDone = Boolean(venmo || zelle) && !editingPay;
  const budgetDone = budgetCents != null;
  const allDone = termsDone && payDone && budgetDone;

  return (
    <div className="px-4 pb-8 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Become a runner</h1>
      <p className="mt-1 text-muted">Three quick steps before your first order.</p>

      <div className="mt-6 space-y-4">
        <Card className={clsx("p-5", termsDone && "opacity-70")}>
          <div className="flex items-center gap-3">
            <StepIcon done={termsDone}>
              <ShieldAlert className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">How running works</p>
              {termsDone ? null : <p className="text-sm text-muted">You front the money; the requester pays you back at handoff.</p>}
            </div>
          </div>
          {termsDone ? null : (
            <div className="mt-5 space-y-5">
              <ul className="space-y-3">
                {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action-soft text-action">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold leading-tight">{title}</p>
                      <p className="text-sm text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Consequences />
              <p className="rounded-2xl bg-warn-soft p-4 text-[15px] font-medium leading-relaxed text-warn-ink">{RUNNER_PROMISE}</p>
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                label="I understand, and I agree to deliver what I claim and only ask for the amount in the app."
              />
              <Button full disabled={!agreed} loading={pending} onClick={() => start(async () => void (await acceptRunnerTerms()))}>
                I agree
              </Button>
            </div>
          )}
        </Card>

        <Card className={clsx("p-5", !termsDone && "pointer-events-none opacity-50", payDone && "opacity-70")}>
          <div className="flex items-center gap-3">
            <StepIcon done={payDone}>
              <HandCoins className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">How you get paid</p>
              <p className="text-sm text-muted">
                {payDone
                  ? [venmo ? `Venmo @${venmo}` : null, zelle ? `Zelle ${formatZelle(zelle)}` : null].filter(Boolean).join(" · ")
                  : "Requesters pay you back here at handoff."}
              </p>
            </div>
            {payDone && termsDone ? (
              <Button size="sm" variant="ghost" onClick={() => setEditingPay(true)}>
                Change
              </Button>
            ) : null}
          </div>
          {termsDone && !payDone ? (
            <div className="mt-4">
              <PayAccountsEditor
                initialVenmo={venmo ?? ""}
                initialZelle={zelle ? formatZelle(zelle) : ""}
                submitLabel="Save"
                onSaved={() => setEditingPay(false)}
              />
            </div>
          ) : null}
        </Card>

        <Card className={clsx("p-5", !(termsDone && payDone) && "pointer-events-none opacity-50")}>
          <div className="flex items-center gap-3">
            <StepIcon done={budgetDone}>
              <Wallet className="size-5" />
            </StepIcon>
            <div className="flex-1">
              <p className="font-bold">Most you&apos;ll front per order</p>
              <p className="text-sm text-muted">
                {budgetDone ? `Up to ${money(budgetCents)}. Change it any time on the Run tab.` : "You'll only see orders at or under it."}
              </p>
            </div>
          </div>
          {termsDone && payDone && !budgetDone ? (
            <div className="mt-4 space-y-3">
              <BudgetStepper value={budget} onChange={setBudget} />
              <p className="text-xs text-muted">Orders with a higher max price pay a slightly higher fee.</p>
              <ErrorText>{error}</ErrorText>
              <Button
                full
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setRunnerBudget(budget);
                    setError(r.ok ? null : r.error);
                  })
                }
              >
                Save
              </Button>
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

/** What happens if either side breaks the deal. */
export function Consequences({ className }: { className?: string }) {
  return (
    <div className={clsx("grid gap-3", className)}>
      {(
        [
          ["If a requester doesn't hold up their end", CONSEQUENCES.requester],
          ["If you don't hold up yours", CONSEQUENCES.runner],
        ] as const
      ).map(([title, rows]) => (
        <div key={title} className="rounded-2xl border border-line p-4">
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-muted">{title}</p>
          <dl className="space-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="font-bold text-ink">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
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
