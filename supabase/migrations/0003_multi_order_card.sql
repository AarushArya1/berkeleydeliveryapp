-- Brings a database that ran the first draft of 0002 (card loaded for one
-- order at a time) up to the final design: one card per runner holding any
-- number of loads, one per claimed order. Safe to run more than once, and a
-- no-op on a database that ran the final 0002.

-- Loads: several open at once per card, at most one per order, plus the
-- same-store "I'm paying for this one" marker.
alter table public.card_loads add column if not exists armed_until timestamptz;
drop index if exists public.card_loads_one_open_per_card;
create index if not exists card_loads_card_open_idx on public.card_loads (card_id) where status = 'loaded';
create unique index if not exists card_loads_one_open_per_request on public.card_loads (request_id) where status = 'loaded';

-- Cards: the order details live on the loads now, so the card only knows
-- whether it's usable.

alter table public.cards drop constraint if exists cards_loaded_has_order;
alter table public.cards drop constraint if exists cards_status_check;
update public.cards set status = case when status = 'frozen' then 'frozen' else 'active' end;
alter table public.cards drop column if exists request_id;
alter table public.cards drop column if exists limit_cents;
alter table public.cards drop column if exists store;
alter table public.cards drop column if exists allowed_category;
alter table public.cards drop column if exists loaded_at;
alter table public.cards drop column if exists closed_at;
alter table public.cards add column if not exists frozen_at timestamptz;
alter table public.cards alter column status set default 'active';
alter table public.cards add constraint cards_status_check check (status in ('active', 'frozen'));
