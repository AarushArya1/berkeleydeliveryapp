"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Wallet } from "lucide-react";
import { setRunnerBudget } from "@/app/actions";
import { RUNNER_BUDGET } from "@/lib/config";
import { money } from "@/lib/format";
import { Button, Card, ErrorText } from "./ui";

const { minCents, maxCents, stepCents } = RUNNER_BUDGET;
const whole = (cents: number) => money(cents).replace(/\.00$/, "");

/** − $50 + picker for the runner's budget. */
export function BudgetStepper({ value, onChange }: { value: number; onChange: (cents: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Lower budget"
          onClick={() => onChange(Math.max(minCents, value - stepCents))}
          className="flex size-11 items-center justify-center rounded-full bg-lime-50 text-lime-900 active:bg-lime-100"
        >
          <Minus className="size-5" />
        </button>
        <p className="text-4xl font-extrabold tabular-nums tracking-tight">{whole(value)}</p>
        <button
          type="button"
          aria-label="Raise budget"
          onClick={() => onChange(Math.min(maxCents, value + stepCents))}
          className="flex size-11 items-center justify-center rounded-full bg-lime-50 text-lime-900 active:bg-lime-100"
        >
          <Plus className="size-5" />
        </button>
      </div>
      <input
        type="range"
        min={minCents / 100}
        max={maxCents / 100}
        step={stepCents / 100}
        value={value / 100}
        onChange={(e) => onChange(Number(e.target.value) * 100)}
        className="mt-4 w-full accent-action"
        aria-label="Budget"
      />
    </div>
  );
}

/** The runner's max per order on the Run tab, and a way to change it. */
export function RunnerBudget({ budgetCents, hiddenCount }: { budgetCents: number; hiddenCount: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budgetCents);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="mt-5 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action-soft text-action">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">Up to {whole(budgetCents)} per order</p>
          <p className="text-sm text-muted">
            {hiddenCount > 0
              ? `${hiddenCount} order${hiddenCount === 1 ? "" : "s"} over your max ${hiddenCount === 1 ? "is" : "are"} hidden`
              : "The most you'll front for one order"}
          </p>
        </div>
        {editing ? null : (
          <Button size="sm" variant="secondary" onClick={() => (setValue(budgetCents), setEditing(true))}>
            Change
          </Button>
        )}
      </div>
      {editing ? (
        <div className="animate-rise mt-4 space-y-3">
          <BudgetStepper value={value} onChange={setValue} />
          <p className="text-xs leading-relaxed text-muted">
            You pay for the items yourself and get paid back at handoff, so you&apos;ll only see orders whose max price is at or under
            this. Pricier orders pay a slightly higher fee.
          </p>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await setRunnerBudget(value);
                  setError(r.ok ? null : r.error);
                  if (r.ok) setEditing(false);
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
