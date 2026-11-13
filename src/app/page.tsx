import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "./welcome";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-lime-50">
          <LogoMark size={56} />
        </div>
      }
    >
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    const mode = (await cookies()).get("dart_mode")?.value;
    redirect(mode === "runner" ? "/run" : "/wishlist");
  }
  return <Welcome />;
}
