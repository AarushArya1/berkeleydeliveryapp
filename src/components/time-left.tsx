"use client";

import { useEffect, useState } from "react";
import { clockTime, timeLeft } from "@/lib/format";

/** Live countdown ("2 hrs") that re-renders every 30s. */
export function TimeLeft({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span suppressHydrationWarning>
      {prefix}
      {timeLeft(iso, now)}
    </span>
  );
}

export function ClockTime({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{clockTime(iso)}</span>;
}
