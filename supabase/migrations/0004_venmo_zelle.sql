-- Early MVP: no Stripe. Runners buy the items with their own money, and the
-- requester pays them back (receipt total + runner fee) by Venmo or Zelle at
-- handoff. Removes the Dart card, card holds, the handoff code, the ledger and
-- Stripe payouts, and adds payment accounts, the runner budget and payment
-- tracking.
--
-- Run this in the Supabase SQL Editor after 0003_multi_order_card.sql.

-- ---------------------------------------------------------------------------
-- Profiles: where you pay from / get paid, and the runner's budget
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists venmo_username text;   -- without the @
alter table public.profiles add column if not exists zelle_contact text;    -- phone (+1...) or email
-- The most a runner will pay up front for one order. They only see orders at or under it.
alter table public.profiles add column if not exists runner_budget_cents int;
alter table public.profiles drop constraint if exists profiles_runner_budget_check;
alter table public.profiles add constraint profiles_runner_budget_check
  check (runner_budget_cents is null or runner_budget_cents between 1000 and 3000);

alter table public.profiles drop column if exists payouts_ready_at;
alter table public.profiles drop column if exists card_issued_at;

-- ---------------------------------------------------------------------------
-- Requests: what's owed at handoff and whether it's been paid
-- ---------------------------------------------------------------------------

alter table public.requests add column if not exists distance_miles numeric(4, 2);   -- store -> drop-off area
alter table public.requests add column if not exists paid_reported_at timestamptz;   -- requester tapped "I've paid"
alter table public.requests add column if not exists paid_method text check (paid_method in ('venmo', 'zelle'));
alter table public.requests add column if not exists auto_complete_at timestamptz;   -- reported paid, runner hasn't answered

alter table public.requests drop column if exists dart_fee_cents;
alter table public.requests drop column if exists hold_cents;
alter table public.requests drop column if exists processing_cents;
alter table public.requests drop column if exists payout_status;
alter table public.requests drop column if exists payout_released_at;
alter table public.requests drop column if exists auto_release_at;
-- charged_cents now means "owed at handoff": receipt total + runner fee.

-- A requester can cancel without paying when the runner blows the delivery window.
alter table public.requests drop constraint if exists requests_cancelled_stage_check;
alter table public.requests add constraint requests_cancelled_stage_check
  check (cancelled_stage in ('before_claim', 'after_claim', 'after_purchase', 'runner_late'));

-- ---------------------------------------------------------------------------
-- Disputes: runners can report a requester who didn't pay
-- ---------------------------------------------------------------------------

alter table public.disputes add column if not exists kind text not null default 'requester'
  check (kind in ('requester', 'unpaid'));
alter table public.disputes drop constraint if exists disputes_status_check;
update public.disputes set status = 'resolved' where status in ('refunded', 'rejected');
alter table public.disputes add constraint disputes_status_check check (status in ('open', 'resolved'));

-- ---------------------------------------------------------------------------
-- Gone: Dart card, handoff code, money ledger
-- ---------------------------------------------------------------------------

drop table if exists public.card_authorizations;
drop table if exists public.card_loads;
drop table if exists public.cards;
drop table if exists public.request_codes;
drop table if exists public.ledger;
