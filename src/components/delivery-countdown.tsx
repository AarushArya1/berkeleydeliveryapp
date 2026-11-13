"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlarmClock } from "lucide-react";
import { DELIVERY_WARNING_MINUTES, DELIVERY_WINDOW_MINUTES } from "@/lib/config";
import { clockTime } from "@/lib/format";

/** Live "X min left to deliver" banner for the runner. */
export function DeliveryCountdown({ deliverBy, bought }: { deliverBy: string; bought: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const end = new Date(deliverBy).getTime();
  const msLeft = end - now;
  const over = msLeft <= 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When time runs out, refresh so the page shows the released/overdue state.
  useEffect(() => {
    if (!over) return;
    router.refresh();
    const again = setTimeout(() => router.refresh(), 35_000);
    return () => clearTimeout(again);
  }, [over, router]);

  const mins = Math.floor(Math.max(0, msLeft) / 60_000);
  const secs = Math.floor((Math.max(0, msLeft) % 60_000) / 1000);
  const urgent = !over && msLeft <= DELIVERY_WARNING_MINUTES * 60_000;
  const pct = Math.max(0, Math.min(100, (msLeft / (DELIVERY_WINDOW_MINUTES * 60_000)) * 100));

  return (
    <div
      role="timer"
      className={clsx(
        "rounded-card border p-4",
        over ? "border-danger/30 bg-danger-soft" : urgent ? "border-warn-ink/20 bg-warn-soft" : "border-action/20 bg-action-soft",
      )}
    >
      <div className="flex items-center gap-3">
        <AlarmClock className={clsx("size-6 shrink-0", over ? "text-danger" : urgent ? "text-warn-ink" : "text-action")} />
        <div className="min-w-0 flex-1">
          <p className={clsx("font-extrabold", over ? "text-danger" : urgent ? "text-warn-ink" : "text-action-ink")} suppressHydrationWarning>
            {over ? "Delivery time is up" : `${mins}:${String(secs).padStart(2, "0")} left to deliver`}
          </p>
          <p className="text-sm text-ink/70" suppressHydrationWarning>
            {over
              ? bought
                ? "Hand off the order now. The Dart team has been notified."
                : "This order is going back on the wishlist."
              : bought
                ? `Hand it off by ${clockTime(deliverBy)}.`
                : `Buy and hand off by ${clockTime(deliverBy)}, or it goes back on the wishlist.`}
          </p>
        </div>
      </div>
      {!over ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className={clsx("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-warn-ink" : "bg-action")}
            style={{ width: `${pct}%` }}
            suppressHydrationWarning
          />
        </div>
      ) : null}
    </div>
  );
}
