"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Smartphone } from "lucide-react";
import { acceptTerms, markHomeScreenDone, saveProfile } from "@/app/actions";
import { InstallGuide, useInstallState } from "@/components/install-guide";
import { Logo } from "@/components/logo";
import { PayAccountFields } from "@/components/pay-accounts";
import { PushButton } from "@/components/push-button";
import { Button, Card, Checkbox, ErrorText, Input, Label, Select } from "@/components/ui";
import { DROPOFF_GROUPS, UNPAID_BAN_HOURS } from "@/lib/config";
import { REPORTABLE } from "@/lib/legal";

type Done = { profile: boolean; homeScreen: boolean; terms: boolean };
type Initial = { fullName: string; dorm: string; phone: string; venmo: string; zelle: string };
const STEPS = ["About you", "Notifications", "Terms"] as const;

export function OnboardingFlow({
  email,
  initial,
  done,
}: {
  email: string;
  initial: Initial;
  done: Done;
}) {
  const step = !done.profile ? 0 : !done.homeScreen ? 1 : 2;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-lime-50 to-white">
      <div className="pt-safe mx-auto max-w-md px-5 pb-12">
        <div className="flex items-center justify-between pt-6">
          <Logo size={28} />
          <span className="text-xs font-semibold text-muted">{email}</span>
        </div>

        <ol className="mt-8 flex gap-2" aria-label="Sign-up steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <div className={clsx("h-1.5 rounded-full", i <= step ? "bg-action" : "bg-lime-100")} />
              <p className={clsx("mt-2 text-xs font-bold", i === step ? "text-ink" : "text-muted")}>{label}</p>
            </li>
          ))}
        </ol>

        <div key={step} className="animate-rise mt-8">
          {step === 0 ? <ProfileStep initial={initial} /> : step === 1 ? <HomeScreenStep /> : <TermsStep />}
        </div>
      </div>
    </div>
  );
}

function ProfileStep({ initial }: { initial: Initial }) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [dorm, setDorm] = useState(initial.dorm);
  const [phone, setPhone] = useState(initial.phone);
  const [venmo, setVenmo] = useState(initial.venmo);
  const [zelle, setZelle] = useState(initial.zelle);
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveProfile({ fullName, dorm, phone, venmo, zelle, smsConsent });
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">You&apos;re verified 🎉</h1>
        <p className="mt-2 text-muted">A few details so runners can find you.</p>
      </div>
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Oski Bear" />
      </div>
      <div>
        <Label htmlFor="dorm" hint="Your default drop-off">
          Where you live
        </Label>
        <Select id="dorm" value={dorm} onChange={(e) => setDorm(e.target.value)}>
          <option value="" disabled>
            Choose your dorm or area
          </option>
          {DROPOFF_GROUPS.slice(0, 2).map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.spots.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </optgroup>
          ))}
          <option>Off-campus</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="phone" hint="For order texts">
          Phone number
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(510) 555-0123"
        />
      </div>
      <PayAccountFields venmo={venmo} zelle={zelle} onVenmo={setVenmo} onZelle={setZelle} />
      <Checkbox
        checked={smsConsent}
        onChange={(e) => setSmsConsent(e.target.checked)}
        label={
          <>
            Text me about my orders, like when a runner claims one. Msg &amp; data rates may apply. Reply STOP to opt out.
          </>
        }
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" full size="lg" loading={pending} disabled={!fullName || !dorm || !phone || !(venmo.trim() || zelle.trim()) || !smsConsent}>
        Continue
      </Button>
    </form>
  );
}

function HomeScreenStep() {
  const install = useInstallState();
  const [pending, start] = useTransition();
  const [pushed, setPushed] = useState(false);
  const finish = () => start(async () => void (await markHomeScreenDone()));

  if (!install) return null;
  const installed = install.standalone;
  const desktop = install.platform === "desktop";
  // iPhone only allows notifications from the home-screen app. Android allows
  // them in the browser too, and its "Add to Home screen" can make a shortcut
  // that opens in a browser tab, so installing is recommended there, not required.
  const android = install.platform === "android";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Never miss your order</h1>
        <p className="mt-2 text-muted">
          Dart lives on your home screen so it can notify you the second a runner claims your order or drops it off.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={clsx(
              "flex size-10 items-center justify-center rounded-full",
              installed ? "bg-lime-300 text-lime-900" : "bg-lime-100 text-lime-700",
            )}
          >
            {installed ? <Check className="size-5" strokeWidth={3} /> : <Smartphone className="size-5" />}
          </span>
          <p className="font-bold">
            {installed ? "Added to your home screen" : android ? "Add Dart to your home screen (recommended)" : "Add Dart to your home screen"}
          </p>
        </div>
        {installed ? null : <InstallGuide platform={install.platform} />}
      </Card>

      {installed || desktop || android ? (
        <>
          <PushButton onDone={(r) => setPushed(r === "granted")} />
          <Button full size="lg" variant={pushed ? "primary" : "secondary"} onClick={finish} loading={pending}>
            {pushed ? "Continue" : desktop ? "Continue on this computer" : "Skip notifications for now"}
          </Button>
          {android && !installed ? (
            <p className="text-center text-xs text-muted">You can keep using Dart right here in Chrome and add it to your home screen later.</p>
          ) : null}
        </>
      ) : (
        <p className="text-center text-sm text-muted">
          Once Dart is on your home screen, open it from there and sign in to finish.
        </p>
      )}
    </div>
  );
}

function TermsStep() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">The ground rules</h1>
        <p className="mt-2 text-muted">Runners pay for your items with their own money. So:</p>
      </div>
      <Card className="divide-y divide-line">
        {[
          ["Pay at handoff, then give your code", "Receipt total + runner fee by Venmo or Zelle, then your 4-digit code.", `Don't pay: suspended right away, banned after ${UNPAID_BAN_HOURS} hours.`],
          ["Cancel free until it's bought", "After your runner buys it, you owe the full amount.", "Cancel and don't pay: same as not paying."],
          ["Show up for handoff", "Not there? Your runner leaves it at your spot, and you still pay.", null],
          ["No restricted items", "No alcohol, tobacco, vapes, prescription drugs or anything age-restricted.", null],
        ].map(([t, d, c]) => (
          <div key={t} className="p-4">
            <p className="font-bold">{t}</p>
            <p className="mt-0.5 text-sm text-muted">{d}</p>
            {c ? <p className="mt-1 text-sm font-semibold text-danger">{c}</p> : null}
          </div>
        ))}
      </Card>
      <p className="rounded-2xl bg-warn-soft p-4 text-sm font-medium leading-relaxed text-warn-ink">{REPORTABLE}</p>
      <Checkbox
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        label={
          <>
            I agree to Dart&apos;s{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-action underline">
              Terms of Service
            </Link>
            .
          </>
        }
      />
      <Button
        full
        size="lg"
        disabled={!agreed}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptTerms();
            if (r.ok) router.replace("/wishlist");
          })
        }
      >
        Start using Dart
      </Button>
    </div>
  );
}
