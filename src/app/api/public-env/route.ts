import { connection } from "next/server";
import { supabasePublicKey, supabaseUrl, vapidPublicKey } from "@/lib/supabase/env";

// The browser's Supabase URL/publishable key and push key, read at request
// time. Used when they weren't baked into the build as NEXT_PUBLIC_* (e.g. on
// Cloudflare, where they're set on the Worker). All three are public values.
export async function GET() {
  await connection();
  return Response.json(
    { supabaseUrl: supabaseUrl(), supabaseKey: supabasePublicKey(), vapidPublicKey: vapidPublicKey() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
