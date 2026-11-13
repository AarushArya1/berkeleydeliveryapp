import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { admin } from "./supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const pushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushConfigured) {
  setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:team@dart.app", VAPID_PUBLIC, VAPID_PRIVATE);
}

// SMS goes through Twilio once 10DLC registration is approved. Until the
// TWILIO_* variables are set, texts are only logged to `notifications`
// (visible on /admin) so the flow can still be tested.
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? "";
const smsConfigured = Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);

export async function sendSms(userId: string, body: string, requestId?: string) {
  const db = admin();
  const { data: profile } = await db.from("profiles").select("phone, sms_consent_at").eq("id", userId).single();
  if (!profile?.phone || !profile.sms_consent_at) return;

  let delivered = false;
  if (smsConfigured) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: profile.phone, From: TWILIO_FROM, Body: body }),
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
  if (pushConfigured) {
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
  return new URL(path, APP_URL).toString();
}
