import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let client: SupabaseClient | null = null;

// Bypasses Row Level Security. Only used in server code after the caller has
// been authenticated and authorized (src/lib/orders.ts).
export function admin() {
  if (!SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY is not set");
  client ??= createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
