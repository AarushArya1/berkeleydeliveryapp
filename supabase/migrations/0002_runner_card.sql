-- One Dart card per runner (replaces one temporary card per order).
--
-- A runner gets their Dart virtual card once, at runner sign-up. With no
-- orders on it, it's locked at $0. Each claim adds a "load" to it: that
-- order's max price, at that order's store, good for a single purchase. A
-- runner can hold several loads at once (one per claimed order). A tap is
-- matched to the load for that store; if two orders are at the same store the
-- runner picks which one they're paying for first ("armed").
--
-- After the purchase (or if the order is cancelled, released or times out)
-- that order's load is closed. The card itself stays.
--
-- Run this in the Supabase SQL Editor after 0001_init.sql.

alter table public.profiles add column if not exists card_issued_at timestamptz;

-- ---------------------------------------------------------------------------
-- Card loads: one row per claimed order
-- ---------------------------------------------------------------------------

create table public.card_loads (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id),
  runner_id uuid not null references public.profiles (id),
  request_id uuid not null references public.requests (id),
  amount_cents int not null,               -- spending limit for this order
  store text not null,                     -- the only merchant this load works at
  allowed_category text not null,
  status text not null default 'loaded' check (status in ('loaded', 'spent', 'unloaded')),
  unload_reason text,                      -- purchased / released / timed_out / cancelled / frozen
  armed_until timestamptz,                 -- "I'm paying for this one" (same-store tie-break)
  loaded_at timestamptz not null default now(),
  closed_at timestamptz
);
create index card_loads_runner_idx on public.card_loads (runner_id, loaded_at desc);
create index card_loads_card_open_idx on public.card_loads (card_id) where status = 'loaded';
-- An order is on a runner's card at most once at a time.
create unique index card_loads_one_open_per_request on public.card_loads (request_id) where status = 'loaded';

-- Carry over the old per-order cards as loads, then keep one card per runner.
insert into public.card_loads (card_id, runner_id, request_id, amount_cents, store, allowed_category, status, unload_reason, loaded_at, closed_at)
select c.id, c.runner_id, c.request_id, c.limit_cents, r.store, c.allowed_category,
       case c.status when 'active' then 'loaded' when 'spent' then 'spent' else 'unloaded' end,
       case c.status when 'spent' then 'purchased' when 'active' then null else c.status end,
       c.created_at, c.closed_at
from public.cards c join public.requests r on r.id = c.request_id;

with keep as (
  select distinct on (runner_id) runner_id, id from public.cards order by runner_id, created_at desc
)
update public.card_loads l set card_id = k.id from keep k where l.runner_id = k.runner_id;

with keep as (
  select distinct on (runner_id) runner_id, id from public.cards order by runner_id, created_at desc
)
update public.card_authorizations a set card_id = k.id from keep k where a.runner_id = k.runner_id;

delete from public.cards c
where c.id not in (select distinct on (runner_id) id from public.cards order by runner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Cards: now one per runner. Order details live on the loads.
-- ---------------------------------------------------------------------------

drop index if exists public.cards_one_active_per_request;
drop index if exists public.cards_request_idx;
alter table public.cards drop constraint if exists cards_status_check;
update public.cards set status = case when status = 'frozen' then 'frozen' else 'active' end;
alter table public.cards drop column if exists request_id;
alter table public.cards drop column if exists limit_cents;
alter table public.cards drop column if exists allowed_category;
alter table public.cards drop column if exists closed_at;
alter table public.cards add column if not exists frozen_at timestamptz;
alter table public.cards alter column status set default 'active';
alter table public.cards add constraint cards_status_check check (status in ('active', 'frozen'));
alter table public.cards add constraint cards_one_per_runner unique (runner_id);

update public.profiles p set card_issued_at = c.created_at from public.cards c where c.runner_id = p.id and p.card_issued_at is null;

alter table public.card_authorizations add column if not exists card_load_id uuid references public.card_loads (id);

alter table public.card_loads enable row level security;
create policy card_loads_read on public.card_loads for select
  using (runner_id = auth.uid() or public.is_admin());
