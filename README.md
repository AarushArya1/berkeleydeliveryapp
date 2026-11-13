# Dart

Verified Berkeley students post what they need to a wishlist; students already heading to the store pick it up for a fee.

This is the MVP prototype. It's a mobile web app (home-screen install for push) built with Next.js 16 + Supabase. **Payments are placeholders:** every money movement is simulated and recorded in a `ledger` table, so the whole order flow works end to end without Stripe.

## The flow

| Step | Requester | Runner |
| --- | --- | --- |
| Sign up | @berkeley.edu email code → name, dorm, phone + SMS consent → add to home screen + notifications → Terms | Same account. Before the first claim: agree to the Dart card rule + Stripe payout setup *(placeholder)* |
| Post | Items, preferred store, max price ($10–$30), drop-off area + spot, open 1 hr–6 days. One total shown; card hold placed *(placeholder)* | — |
| Find | — | Feed filtered by **store I'm at** and **where it's going**. Requester name and exact spot stay hidden |
| Claim | Text + push: who claimed it and ETA. 4-digit code appears in the app | Picks ETA (≤ 45 min). A new temporary Dart card is created for this order only. **45-minute delivery window starts** with a live countdown |
| Buy | Charged exact amount + fees at purchase; rest of the hold released | "Taps" the Dart card *(simulated)*. Approved only if the order is active, amount ≤ max, store type matches |
| Proof | Sees the items + receipt photo | Photographs items + receipt, taps **Purchased** |
| Handoff | Gives the code | Enters code → fee released (daily payout) |
| No-code fallback | Can tap "I got it" or report a problem within 3 hrs | Uploads drop-off photo (+ one-time location). Fee auto-releases after 3 hrs |
| After | Rate runner; report a problem within 24 hrs | Rate requester |

All cancellation and dispute rules from plan section 5 are implemented in `src/lib/orders.ts`. Team members with `is_admin` get a dashboard at **/admin**: pilot metrics (claim rate, time to claim, repeat users, reserve, float needed), unclaimed orders for the backup runner, dispute resolution, user suspend/ban, and an outbox of every text/push.

## Setup

### 1. Supabase

1. **Run the schema.** Supabase dashboard → SQL Editor → paste and run `supabase/migrations/0001_init.sql`. (Or `supabase db push` with the CLI.)
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

Deploy to Vercel and add the same env vars. `vercel.json` runs `/api/cron` every 10 minutes to expire requests and auto-release fallbacks (set `CRON_SECRET`). Pages also run this lazily, so it works without cron too.

## Placeholders to replace

| Placeholder | Where | Replace with |
| --- | --- | --- |
| Card hold / charge / release / refund | `src/lib/payments/index.ts` | Stripe PaymentIntents (`capture_method: manual`, partial capture) |
| Dart card + "Tap Dart card" simulator | `src/lib/payments/index.ts`, `runner-view.tsx` | Stripe Issuing virtual cards. `decideAuthorization()` in `src/lib/payments/authorize.ts` is already written to back the `issuing_authorization.request` webhook |
| Runner payout setup button | `completePayoutSetup` in `src/app/actions.ts` | Stripe Connect Express hosted onboarding |
| Payouts | `payments.releasePayout` | Transfers to Connect accounts (daily standard payouts) |
| SMS | `src/lib/notify.ts` | Already calls Twilio when `TWILIO_*` is set. Until 10DLC is approved, texts are logged to `/admin` |
| Fees ($x, $y) | `.env` `NEXT_PUBLIC_RUNNER_FEE_CENTS`, `NEXT_PUBLIC_DART_FEE_CENTS` | Real prices (currently $3.00 / $1.50) |
| Reserve share `[__]%` | `RESERVE_SHARE` in `src/lib/config.ts` | Sized from pilot data (currently 25%) |
| Trust tiers | `TRUST_TIERS*` in `src/lib/config.ts` | Turn on after the pilot |
| Launch area | `LAUNCH_ZONES`, `DORMS`, `STORES` in `src/lib/config.ts` | Your dorm cluster |
| Terms of Service | `src/app/terms/page.tsx` | Lawyer-reviewed version |

## Code map

```
supabase/migrations/0001_init.sql   schema, RLS (users read only; server writes), storage bucket
src/lib/config.ts                   stores, dorms, fees, limits, restricted-item screen
src/lib/orders.ts                   the order state machine (all writes)
src/lib/payments/                   payments placeholder + Dart card approval rule
src/lib/notify.ts                   SMS (Twilio) + web push
src/app/actions.ts                  server actions the UI calls
src/app/(app)/wishlist              requester: list + post
src/app/(app)/run                   runner: feed, setup, my runs
src/app/(app)/orders/[id]           order page (requester / runner / prospective runner views)
src/app/admin                       team dashboard
```

## Notes on decisions

- **Email code, not magic link.** On iPhone a magic link opens Safari, which doesn't share a login with the home-screen app.
- **A new temporary Dart card per claim.** Each claim issues a fresh card ($0.10 Issuing fee per card, logged in the ledger) limited to that order's max price and store type. It closes for good once the order is bought, cancelled or released, so runners can hold several claims at once, each with its own card.
- **Runners can release an order before buying.** It goes back on the wishlist. The plan doesn't cover a runner backing out, and without this an order could get stuck.
- **"Nearby" = the launch area.** There's no location tracking in v1, so every verified member sees open requests in the launch dorm cluster, with only the area shown until claim.
- **45-minute delivery window** (`DELIVERY_WINDOW_MINUTES`). Runners see it before claiming, as a live countdown on the order, and as a push at 10 minutes left. Not bought in time: the claim is released back to the wishlist and its card is closed (the card also declines after the deadline). Bought but late: the order isn't cancelled, since the requester already paid. Both sides get a push and `/admin` flags it "Past 45 min".
- **Repeat no-shows** = 2 fallback auto-releases → banned (`NO_SHOW_BAN_THRESHOLD`).
