-- Dart MVP schema.
--
-- Reads from the browser go through Row Level Security. Every state change
-- (posting, claiming, purchasing, payouts...) happens on the server with the
-- service-role key, in src/lib/orders.ts, so users can never write order or
-- money columns directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  dorm text,
  phone text,
  default_spot text,                       -- last drop-off spot, prefilled on new requests
  sms_consent_at timestamptz,
  tos_accepted_at timestamptz,
  home_screen_at timestamptz,              -- added to home screen (or desktop testing skip)
  runner_terms_accepted_at timestamptz,    -- Dart card misuse warning
  payouts_ready_at timestamptz,            -- PLACEHOLDER for Stripe Connect Express onboarding
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  no_show_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Only @berkeley.edu addresses can create an account. Raising here aborts the
-- sign-up, so the "send code" call fails for any other domain.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@berkeley.edu' then
    raise exception 'Dart is only open to @berkeley.edu emails';
  end if;
  insert into public.profiles (id, email) values (new.id, lower(new.email));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- A verified, onboarded, non-suspended member (allowed to see the wishlist).
create function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active' and tos_accepted_at is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- Requests (wishlist items)
-- ---------------------------------------------------------------------------
-- Status flow:
--   open -> claimed -> purchased -> delivering -> completed
--                                             \-> dropped_off -> completed   (no-code fallback)
--   open -> expired | cancelled
--   claimed -> cancelled | open (runner released it)
--   purchased/delivering/dropped_off -> cancelled (requester pays in full)
--   purchased.. completed -> disputed -> refunded | completed

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id),
  items text not null,
  notes text,
  store text not null,
  dropoff_zone text not null,              -- public: general area only
  max_price_cents int not null check (max_price_cents >= 1000),
  runner_fee_cents int not null,
  dart_fee_cents int not null,
  hold_cents int not null,
  status text not null default 'open' check (status in (
    'open', 'claimed', 'purchased', 'delivering', 'dropped_off',
    'completed', 'cancelled', 'expired', 'disputed', 'refunded'
  )),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  runner_id uuid references public.profiles (id),
  claimed_at timestamptz,
  eta_at timestamptz,
  deliver_by timestamptz,                  -- claimed_at + 45 min delivery window
  deliver_warned_at timestamptz,           -- "10 minutes left" push sent
  overdue_notified_at timestamptz,         -- bought but not handed off in time

  purchase_cents int,
  purchase_merchant text,
  processing_cents int,
  charged_cents int,
  purchased_at timestamptz,

  items_photo_path text,
  picked_up_at timestamptz,                -- runner tapped "Purchased"

  dropoff_photo_path text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropped_off_at timestamptz,
  auto_release_at timestamptz,

  completed_at timestamptz,
  completion_method text check (completion_method in ('code', 'fallback', 'confirmed')),

  cancelled_at timestamptz,
  cancelled_stage text check (cancelled_stage in ('before_claim', 'after_claim', 'after_purchase')),

  status_before_dispute text,
  payout_status text not null default 'none' check (payout_status in ('none', 'pending', 'released', 'withheld')),
  payout_released_at timestamptz
);

create index requests_open_idx on public.requests (status, expires_at);
create index requests_requester_idx on public.requests (requester_id, created_at desc);
create index requests_runner_idx on public.requests (runner_id, created_at desc);
create index requests_deliver_by_idx on public.requests (status, deliver_by);

-- Exact drop-off spot: hidden until a runner claims.
create table public.request_private (
  request_id uuid primary key references public.requests (id) on delete cascade,
  dropoff_spot text not null
);

-- 4-digit handoff code: only the requester can read it.
create table public.request_codes (
  request_id uuid primary key references public.requests (id) on delete cascade,
  code text not null,
  attempts int not null default 0
);

-- ---------------------------------------------------------------------------
-- Dart cards (PLACEHOLDER for Stripe Issuing virtual cards)
--
-- A new temporary card is issued every time a runner claims a request. It is
-- tied to that one order, loaded with its max price and store type, and closed
-- for good once the order is bought, cancelled or released.
-- ---------------------------------------------------------------------------

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles (id),
  request_id uuid not null references public.requests (id),
  last4 text not null,
  exp text not null,
  status text not null default 'active' check (status in ('active', 'spent', 'cancelled', 'frozen')),
  limit_cents int not null,
  allowed_category text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index cards_runner_idx on public.cards (runner_id);
create index cards_request_idx on public.cards (request_id);
-- At most one usable card per order (a re-claimed order gets a fresh card).
create unique index cards_one_active_per_request on public.cards (request_id) where status = 'active';

create table public.card_authorizations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id),
  runner_id uuid not null references public.profiles (id),
  request_id uuid references public.requests (id),
  amount_cents int not null,
  merchant text not null,
  merchant_category text not null,
  approved boolean not null,
  decline_reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money ledger: every simulated payment event, so the pilot can be audited
-- and the reserve / float sized from real numbers.
-- ---------------------------------------------------------------------------

create table public.ledger (
  id bigint generated always as identity primary key,
  request_id uuid references public.requests (id),
  user_id uuid references public.profiles (id),
  kind text not null,
  amount_cents int not null,
  note text,
  created_at timestamptz not null default now()
);
create index ledger_request_idx on public.ledger (request_id);

-- Every time a runner ran out of the 45-minute delivery window. Kept separately
-- because a timed-out claim is reset back to "open" on the request itself.
create table public.delivery_timeouts (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id),
  runner_id uuid not null references public.profiles (id),
  stage text not null check (stage in ('before_purchase', 'after_purchase')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ratings, disputes, notifications
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (request_id, rater_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id),
  opened_by uuid not null references public.profiles (id),
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'refunded', 'rejected')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  request_id uuid references public.requests (id),
  channel text not null check (channel in ('sms', 'push')),
  body text not null,
  delivered boolean not null default false,  -- false = logged only (provider not configured)
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (read-only for users; writes go through the server)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_private enable row level security;
alter table public.request_codes enable row level security;
alter table public.cards enable row level security;
alter table public.card_authorizations enable row level security;
alter table public.ledger enable row level security;
alter table public.delivery_timeouts enable row level security;
alter table public.ratings enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Open requests are visible only to verified members; everything else only to
-- the two people on the order.
create policy requests_read on public.requests for select
  using (
    requester_id = auth.uid()
    or runner_id = auth.uid()
    or public.is_admin()
    or (status = 'open' and expires_at > now() and public.is_active_member())
  );

create policy request_private_read on public.request_private for select
  using (
    public.is_admin() or exists (
      select 1 from public.requests r
      where r.id = request_id and (r.requester_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy request_codes_read on public.request_codes for select
  using (
    public.is_admin() or exists (
      select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid()
    )
  );

create policy cards_read on public.cards for select
  using (runner_id = auth.uid() or public.is_admin());

create policy card_auths_read on public.card_authorizations for select
  using (runner_id = auth.uid() or public.is_admin());

create policy ledger_read on public.ledger for select
  using (user_id = auth.uid() or public.is_admin());

create policy delivery_timeouts_read on public.delivery_timeouts for select
  using (runner_id = auth.uid() or public.is_admin());

create policy ratings_read on public.ratings for select
  using (rater_id = auth.uid() or ratee_id = auth.uid() or public.is_admin());

create policy disputes_read on public.disputes for select
  using (
    public.is_admin() or exists (
      select 1 from public.requests r
      where r.id = request_id and (r.requester_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy notifications_read on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy push_subscriptions_read on public.push_subscriptions for select
  using (user_id = auth.uid());

-- Live updates on order pages and the runner feed.
alter publication supabase_realtime add table public.requests;

-- Private bucket for item/receipt and drop-off photos. The server uploads and
-- hands out short-lived signed URLs after checking who is asking.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;
