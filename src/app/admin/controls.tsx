"use client";

import { useState, useTransition } from "react";
import { resolveDispute, runMaintenanceNow, setUserStatus } from "@/app/actions";
import { Button, Checkbox, ErrorText, Input, Select } from "@/components/ui";

export function DisputeResolver({ disputeId, unpaid }: { disputeId: string; unpaid: boolean }) {
  const [banRequester, setBanRequester] = useState(false);
  const [suspendRunner, setSuspendRunner] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (outcome: "settled" | "cancel") =>
    start(async () => {
      setError(null);
      const r = await resolveDispute(disputeId, { outcome, banRequester, suspendRunner, note });
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <Checkbox checked={banRequester} onChange={(e) => setBanRequester(e.target.checked)} label="Ban the requester (e.g. never paid)" />
      <Checkbox checked={suspendRunner} onChange={(e) => setSuspendRunner(e.target.checked)} label="Suspend the runner (e.g. didn't deliver, overcharged)" />
      <Input className="h-10" placeholder="Note to both (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => go("settled")}>
          {unpaid ? "Paid now: complete it" : "Resolved: complete it"}
        </Button>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => go("cancel")}>
          Close: nothing owed
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
      Run expiry &amp; auto-complete
    </Button>
  );
}
