"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Email one-time code instead of a magic link: on iPhone a link would open in
// Safari, not in the home-screen app where the user needs to be signed in.

export function LoginForm() {
  const router = useRouter();
  const [netId, setNetId] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function sendCode(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setError(null);
    const user = netId.trim().toLowerCase().replace(/@berkeley\.edu$/, "");
    if (!/^[a-z0-9._+-]+$/.test(user)) {
      setError("Enter your Berkeley email, like oski@berkeley.edu");
      return;
    }
    const email = `${user}@berkeley.edu`;
    setBusy(true);
    const { error } = await (await createClient()).auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setError(error.message.includes("berkeley.edu") ? "Dart is only open to @berkeley.edu emails." : error.message);
      return;
    }
    setSentTo(email);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    const { error } = await (await createClient()).auth.verifyOtp({ email: sentTo, token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError("That code didn't work. Check your email or send a new one.");
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-lime-50 to-white">
      <div className="pt-safe mx-auto max-w-md px-5 pb-10">
        <div className="pt-6">
          <Logo size={30} />
        </div>

        {!sentTo ? (
          <form onSubmit={sendCode} className="animate-rise mt-12 space-y-5">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
              <p className="mt-2 text-muted">We&apos;ll email you a code to verify you&apos;re a Berkeley student.</p>
            </div>
            <div>
              <Label htmlFor="email">Berkeley email</Label>
              <div className="flex items-center rounded-2xl border border-line bg-white focus-within:border-action focus-within:ring-4 focus-within:ring-action/10">
                <input
                  id="email"
                  className="h-14 min-w-0 flex-1 rounded-l-2xl bg-transparent pl-4 text-ink outline-none placeholder:text-muted/70"
                  placeholder="oski"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  value={netId}
                  onChange={(e) => setNetId(e.target.value)}
                  autoFocus
                />
                <span className="pr-4 font-semibold text-muted">@berkeley.edu</span>
              </div>
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" full size="lg" loading={busy} disabled={!netId.trim()}>
              <Mail className="size-5" /> Email me a code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="animate-rise mt-12 space-y-5">
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setCode("");
                setError(null);
              }}
              className="flex items-center gap-1 text-sm font-semibold text-muted"
            >
              <ArrowLeft className="size-4" /> Change email
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Check your email</h1>
              <p className="mt-2 text-muted">
                Enter the code we sent to <b className="text-ink">{sentTo}</b>.
              </p>
            </div>
            <Input
              ref={codeRef}
              className="h-16 text-center text-3xl font-bold tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" full size="lg" loading={busy} disabled={code.length < 6}>
              Verify
            </Button>
            <button type="button" onClick={() => sendCode()} className="w-full text-center text-sm font-semibold text-action">
              Send a new code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
