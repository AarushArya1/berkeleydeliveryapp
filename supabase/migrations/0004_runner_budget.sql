-- Runner budget: the most a runner is willing to have on their Dart card at
-- once, across all the orders they've claimed. Null means the default ($50,
-- RUNNER_BUDGET in src/lib/config.ts). A claim that would go over it is refused.
--
-- Run this in the Supabase SQL Editor after 0003_multi_order_card.sql.

alter table public.profiles add column if not exists runner_budget_cents int;
alter table public.profiles drop constraint if exists profiles_runner_budget_check;
alter table public.profiles add constraint profiles_runner_budget_check
  check (runner_budget_cents is null or runner_budget_cents between 1000 and 15000);
