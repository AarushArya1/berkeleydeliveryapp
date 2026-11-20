-- Brings back the 4-digit handoff code (0004 removed it). The requester gives
-- it to the runner after paying; the runner enters it to finish the order.
--
-- Run this in the Supabase SQL Editor after 0004_venmo_zelle.sql.

create table if not exists public.request_codes (
  request_id uuid primary key references public.requests (id) on delete cascade,
  code text not null,
  attempts int not null default 0
);

alter table public.request_codes enable row level security;

-- Only the requester can read it.
drop policy if exists request_codes_read on public.request_codes;
create policy request_codes_read on public.request_codes for select
  using (
    public.is_admin() or exists (
      select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid()
    )
  );

-- Orders already claimed get a code too.
insert into public.request_codes (request_id, code)
select id, lpad((floor(random() * 10000))::int::text, 4, '0')
from public.requests
where status in ('claimed', 'delivering', 'dropped_off')
on conflict (request_id) do nothing;
