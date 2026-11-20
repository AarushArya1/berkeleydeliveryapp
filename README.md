# Dart

Verified Berkeley students post what they need to a shopping list (the plan calls it a wishlist); students already heading to the store pick it up for a fee.

This is the early MVP, built to test demand. It's a mobile web app (home-screen install for push) built with Next.js 16 + Supabase. **No Stripe yet:** runners buy the items with their own money, and requesters pay them back (receipt total + a runner fee Dart sets) by **Venmo or Zelle at handoff**. Dart never touches the money; it tracks who owes what and enforces the consequences when either side breaks the deal. Stripe (holds, Dart cards, payouts) comes back once its approvals are done.

## The flow

| Step | Requester | Runner |
| --- | --- | --- |
| Sign up | @berkeley.edu email code → name, dorm, phone, **Venmo and/or Zelle** + SMS consent → home screen + notifications → ground rules + Terms | Same account. Before the first claim: how running works + the consequences, agree; confirm Venmo/Zelle; set the **most they'll front per order** |
| Post | Items, store, max price ($10–$30), drop-off area + spot, open 1 hr–6 days. Sees the runner fee (distance + price formula) and the most they'll pay; agrees to pay at handoff | — |
| Find | — | Feed filtered by the stores they're at/going to and where it's going (multi-select, defaults to their dorm). **Only orders at or under their max are shown.** Name and exact spot stay hidden |
| Claim | Text + push: who claimed it and ETA. 4-digit handoff code appears in the app | Picks ETA (≤ 45 min). Must accept a payment app the requester uses. **45-minute window starts** |
| Buy | Text + push with the **exact** amount owed and the receipt photo. **Checks the photo against the total: Matches → pay; Doesn't match → report** (goes to the team) | Pays with their own money, then **uploads the receipt photo + its total first**; the final fee is computed from that real price. Items photo optional. Can save the receipt photo; keeps the paper receipt |
| Handoff | Sees the amount owed and the runner's Venmo (one-tap link with amount + note) or Zelle (copy), pays, taps **I paid**, gives the code | Enters the code once paid → done ("I got paid" if the code is lost). Or **didn't pay** → requester suspended, banned after 24 hrs |
| No-show | Still owes the full amount | Leaves it at the spot with a photo, or keeps it and returns it with the receipt |
| After | Rate runner; report a problem within 24 hrs | Rate requester |

Cancellations, reports and penalties are in `src/lib/orders.ts`; the wording users agree to is in `src/lib/legal.ts`. Team members with `is_admin` get a dashboard at **/admin**: pilot metrics (claim rate, time to claim, repeat users, average fee, money owed to runners), unclaimed orders for the backup runner, unpaid/problem reports, user suspend/ban, and an outbox of every text/push.

## Setup

### 1. Supabase

1. **Run the schema.** Supabase dashboard → SQL Editor → paste and run each file in `supabase/migrations/` in order (`0001_init.sql` … `0004_venmo_zelle.sql`). (Or `supabase db push` with the CLI.)
2. **Email code sign-in.** Authentication → Emails → edit both the *Magic Link* and *Confirm signup* templates (first-time users get the second one) to show the code so users can type it in the home-screen app:
   ```html
   <h2>Your Dart code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   ```
3. **Custom SMTP (before the pilot).** Supabase's built-in email only sends a few emails per hour. Authentication → Emails → SMTP Settings → plug in Resend, Postmark, etc.
4. **Site URL.** Authentication → URL Configuration → set to your deployed URL.

### 2. Environment

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key + secret key
npm install
npm run dev
```

For push notifications, run `npx web-push generate-vapid-keys` and add the keys to `.env.local`. Push and the home-screen install need HTTPS, so test those on a deployed URL (e.g. Vercel). Locally everything else works, and on a laptop the onboarding lets you skip the home-screen step.

### 3. Make yourself an admin

After signing up once, run in the SQL Editor:

```sql
update profiles set is_admin = true where email = 'you@berkeley.edu';
```

### 4. Deploy

Deploy to Vercel and add the same env vars. `vercel.json` runs `/api/cron` every 10 minutes to expire requests, enforce the delivery window, auto-complete paid orders and ban unpaid ones (set `CRON_SECRET`). Pages also run this lazily, so it works without cron too.

**Cloudflare Workers.** `NEXT_PUBLIC_*` values are baked in at build time, so on a Worker set the plain names at runtime (Settings → Variables and Secrets). Add them as **Secrets**, since plain variables set in the dashboard are overwritten by the next deploy unless they're also in a Wrangler config.

| Variable | Needed for |
| --- | --- |
| `SUPABASE_URL` | everything (a trailing `/rest/v1/` is fine, it's trimmed) |
| `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) | everything |
| `SUPABASE_SECRET_KEY` | every signed-in page and action; without it they error |
| `APP_URL` | links in push notifications (e.g. `https://your-domain`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push notifications |
| `CRON_SECRET` | `/api/cron` |
| `TWILIO_*` | texts (optional) |

The browser gets the public ones (Supabase URL + publishable key, VAPID public key) from `/api/public-env` when they weren't baked into the build.

## Still to come

| What | Where | Later |
| --- | --- | --- |
| Payments | Venmo/Zelle between users (`src/lib/pay.ts`, `PayCard` in `requester-view.tsx`) | Stripe: card hold at posting, Dart virtual card for runners, Connect payouts |
| Runner fee formula | `RUNNER_FEE` in `src/lib/config.ts`: $2 + $1.50/mile + 8% of max price, rounded up to 25¢, $3–$8 | Tune from pilot data |
| Dart fee | None during the MVP | Add with Stripe |
| SMS | `src/lib/notify.ts` | Already calls Twilio when `TWILIO_*` is set. Until 10DLC is approved, texts are logged to `/admin` |
| Launch area | `LAUNCH_ZONES`, `ZONE_COORDS`, `DORMS`, `STORES` in `src/lib/config.ts` | Your dorm cluster |
| Terms of Service | `src/app/terms/page.tsx`, `src/lib/legal.ts` | Lawyer-reviewed version |

## Code map

```
supabase/migrations/0001_init.sql   schema, RLS (users read only; server writes), storage bucket
src/lib/config.ts                   stores, dorms, fee formula, limits, penalties, restricted-item screen
src/lib/orders.ts                   the order state machine (all writes)
src/lib/fees.ts, src/lib/pay.ts      runner fee + distance; Venmo/Zelle helpers
src/lib/notify.ts                   SMS (Twilio) + web push
src/app/actions.ts                  server actions the UI calls
src/app/(app)/wishlist              requester: list + post
src/app/(app)/run                   runner: feed, setup, my runs
src/app/(app)/orders/[id]           order page (requester / runner / prospective runner views)
src/app/admin                       team dashboard
```

## Notes on decisions

- **Email code, not magic link.** On iPhone a magic link opens Safari, which doesn't share a login with the home-screen app.
- **Pay at handoff, runner fronts the money.** The requester pays the receipt total (never more than their max) plus the runner fee directly to the runner. The requester pays, then gives the 4-digit code; the runner entering it confirms payment and handoff and completes the order. Without a code (dropped off, cancelled after purchase), the runner taps "I got paid". If the requester says they paid and the runner never answers within 24 hrs, it completes on its own.
- **Runner fee = distance + price.** Distance is store → drop-off area (straight line × 1.3 for walking). Pricier orders pay more because the runner fronts more. At posting the fee is an **estimate** from the max price (shown as "~$X" to both sides); the **final** fee is computed from the receipt total.
- **Receipt first, checked by the requester.** No OCR/AI, to keep it free: the runner uploads the receipt photo and types its total, and the requester must confirm it matches before the pay buttons appear. "Doesn't match" opens a report for the team. Entering the handoff code also counts as accepting the receipt.
- **Runner max per order** (`RUNNER_BUDGET`, $10–$30). Orders above it are hidden from the feed and can't be claimed.
- **Payment apps must match.** A runner can only claim an order if they accept Venmo or Zelle that the requester uses.
- **Consequences, no strike system.** Requester doesn't pay (including after cancelling a bought order): suspended at once when the runner reports it, banned after 24 hrs unless they pay (`UNPAID_BAN_HOURS`). No-show: still owes. Runner doesn't buy in time: the order goes back on the list. Runner is late: the requester can cancel owing nothing. Overcharging or not delivering: reported, and the team can suspend or ban. Everyone is told they can be reported to the Dart team and UC Berkeley, since every account is a verified @berkeley.edu email.
- **Runners can release an order before buying.** It goes back on the shopping list. The plan doesn't cover a runner backing out, and without this an order could get stuck.
- **"Nearby" = the launch area.** There's no location tracking in v1, so every verified member sees open requests in the launch dorm cluster, with only the area shown until claim.
- **45-minute delivery window** (`DELIVERY_WINDOW_MINUTES`), counted from the claim. Runners see it before claiming, as a live countdown, and as a push at 10 minutes left. Not bought in time: back on the shopping list. Bought but late: both sides get a push, the requester may cancel owing nothing, and `/admin` flags it "Past 45 min".
