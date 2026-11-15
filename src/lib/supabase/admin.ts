import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

let client: SupabaseClient | null = null;

// Bypasses Row Level Security. Only used in server code after the caller has
// been authenticated and authorized (src/lib/orders.ts).
export function admin() {
  if (client) return client;
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  client = createClient(supabaseUrl(), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
