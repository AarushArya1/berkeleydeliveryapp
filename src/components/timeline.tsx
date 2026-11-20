import clsx from "clsx";
import { Check } from "lucide-react";
import type { RequestStatus } from "@/lib/types";

const STEPS = ["Posted", "Claimed", "Bought", "Handoff", "Paid"];

function stepIndex(status: RequestStatus, before: RequestStatus | null): number {
  switch (status) {
    case "open":
      return 0;
    case "claimed":
      return 1;
    case "purchased":
      return 2;
    case "delivering":
    case "dropped_off":
      return 3;
    case "completed":
    case "refunded":
      return 4;
    case "disputed":
      return before ? stepIndex(before, null) : 3;
    default:
      return -1;
  }
}

export function Timeline({ status, before }: { status: RequestStatus; before: RequestStatus | null }) {
  const current = stepIndex(status, before);
  if (current < 0) return null;
  return (
    <ol className="flex items-start">
      {STEPS.map((label, i) => {
        const done = i < current || (i === current && (status === "completed" || status === "refunded"));
        const now = i === current && !done;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {i > 0 ? (
              <span className={clsx("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-action" : "bg-line")} />
            ) : null}
            <span
              className={clsx(
                "relative z-10 flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                done ? "bg-action text-white" : now ? "pulse-ring bg-lime-300 text-lime-900" : "bg-white text-muted ring-2 ring-line",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3.5} /> : i + 1}
            </span>
            <span className={clsx("mt-1.5 text-center text-[11px] font-semibold leading-tight", i <= current ? "text-ink" : "text-muted")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
