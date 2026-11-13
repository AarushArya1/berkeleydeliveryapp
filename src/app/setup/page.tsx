import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";

export const metadata = { title: "Setup · Dart" };

// Shown until Supabase environment variables are set.
export default function SetupPage() {
  return (
    <div className="min-h-dvh bg-lime-50">
      <div className="mx-auto max-w-lg px-5 py-10">
        <Logo />
        <Card className="mt-8 space-y-4 p-6">
          <h1 className="text-2xl font-extrabold">Connect Supabase</h1>
          <p className="text-muted">
            Copy <code className="rounded bg-lime-50 px-1.5 py-0.5 font-mono text-sm">.env.example</code> to{" "}
            <code className="rounded bg-lime-50 px-1.5 py-0.5 font-mono text-sm">.env.local</code>, fill in your Supabase URL and keys,
            run the SQL in <code className="rounded bg-lime-50 px-1.5 py-0.5 font-mono text-sm">supabase/migrations</code>, then restart{" "}
            <code className="rounded bg-lime-50 px-1.5 py-0.5 font-mono text-sm">npm run dev</code>.
          </p>
          <p className="text-sm text-muted">See README.md for the full checklist.</p>
        </Card>
      </div>
    </div>
  );
}
