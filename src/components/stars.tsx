"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { rate } from "@/app/actions";
import { Button, ErrorText, Input } from "./ui";

export function RateForm({ requestId, who }: { requestId: string; who: string }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <p className="font-bold">How was {who}?</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} stars`} onClick={() => setStars(n)}>
            <Star className={clsx("size-9 transition-colors", n <= stars ? "fill-lime-400 text-lime-500" : "text-line")} />
          </button>
        ))}
      </div>
      {stars > 0 ? (
        <>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)" maxLength={300} />
          <ErrorText>{error}</ErrorText>
          <Button
            full
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await rate(requestId, stars, comment);
                if (!r.ok) setError(r.error);
              })
            }
          >
            Submit rating
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function StarsShown({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={clsx("size-4", n <= value ? "fill-lime-400 text-lime-500" : "text-line")} />
      ))}
    </span>
  );
}
