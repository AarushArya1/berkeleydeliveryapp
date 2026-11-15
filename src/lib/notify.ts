import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { admin } from "./supabase/admin";
import { vapidPublicKey } from "./supabase/env";

// Read at call time, not import time, so runtime variables on Cloudflare are
// picked up (NEXT_PUBLIC_* names are baked in at build).
function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

let vapidReady: boolean | null = null;
function pushConfigured() {
  if (vapidReady != null) return vapidReady;
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  vapidReady = Boolean(publicKey && privateKey);
  if (vapidReady) setVapidDetails(process.env.VAPID_SUBJECT || "mailto:team@dart.app", publicKey, privateKey);
  return vapidReady;
}

// SMS goes through Twilio once 10DLC registration is approved. Until the
// TWILIO_* variables are set, texts are only logged to `notifications`
// (visible on /admin) so the flow can still be tested.
function twilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const from = process.env.TWILIO_FROM_NUMBER ?? "";
  return sid && token && from ? { sid, token, from } : null;
}

export async function sendSms(userId: string, body: string, requestId?: string) {
  const db = admin();
  const { data: profile } = await db.from("profiles").select("phone, sms_consent_at").eq("id", userId).single();
  if (!profile?.phone || !profile.sms_consent_at) return;

  let delivered = false;
  const tw = twilio();
  if (tw) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${tw.sid}:${tw.token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: profile.phone, From: tw.from, Body: body }),
      });
      delivered = res.ok;
    } catch (e) {
      console.error("sms failed", e);
    }
  } else {
    console.log(`[sms placeholder] to ${profile.phone}: ${body}`);
  }
  await db.from("notifications").insert({ user_id: userId, request_id: requestId ?? null, channel: "sms", body, delivered });
}

export async function sendPush(userId: string, msg: { title: string; body: string; url?: string }, requestId?: string) {
  const db = admin();
  let delivered = false;
  if (pushConfigured()) {
    const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", userId);
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/" });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          delivered = true;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("push failed", e);
        }
      }),
    );
  }
  await db
    .from("notifications")
    .insert({ user_id: userId, request_id: requestId ?? null, channel: "push", body: `${msg.title} — ${msg.body}`, delivered });
}

export function orderUrl(requestId: string) {
  return `/orders/${requestId}`;
}

export function absoluteUrl(path: string) {
  return new URL(path, appUrl()).toString();
}
