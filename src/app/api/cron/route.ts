import { runMaintenance } from "@/lib/orders";

// Expires open requests and releases no-code fallbacks after 3 hours.
// Schedule it (vercel.json runs it every 10 minutes); pages also run it lazily.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await runMaintenance({ force: true });
  return Response.json({ ok: true });
}
