"use client";

import { useState, useTransition } from "react";
import { resolveDispute, runMaintenanceNow, setUserStatus } from "@/app/actions";
import { Button, Checkbox, ErrorText, Input, Select } from "@/components/ui";
import { dollarsToCents } from "@/lib/format";

export function DisputeResolver({ disputeId, chargedCents }: { disputeId: string; chargedCents: number }) {
  const [refund, setRefund] = useState((chargedCents / 100).toFixed(2));
  const [payRunner, setPayRunner] = useState(false);
  const [suspend, setSuspend] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (outcome: "refund" | "reject") =>
    start(async () => {
      setError(null);
      const r = await resolveDispute(disputeId, { outcome, refundCents: dollarsToCents(refund) || 0, payRunner, suspendRunner: suspend, note });
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Refund $</span>
        <Input className="h-10 w-28" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} />
      </div>
      <Checkbox checked={payRunner} onChange={(e) => setPayRunner(e.target.checked)} label="Still pay the runner their fee (e.g. damage wasn't their fault)" />
      <Checkbox checked={suspend} onChange={(e) => setSuspend(e.target.checked)} label="Freeze runner's card and suspend their account" />
      <Input className="h-10" placeholder="Note to requester (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => go("refund")}>
          Refund from reserve
        </Button>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => go("reject")}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function UserControls({ userId, status }: { userId: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <Select
      className="h-9 w-32 rounded-xl text-sm"
      value={status}
      disabled={pending}
      onChange={(e) => start(async () => void (await setUserStatus(userId, e.target.value as "active" | "suspended" | "banned")))}
    >
      <option value="active">Active</option>
      <option value="suspended">Suspend</option>
      <option value="banned">Ban</option>
    </Select>
  );
}

export function MaintenanceButton() {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => void (await runMaintenanceNow()))}>
      Run expiry &amp; auto-release
    </Button>
  );
}
