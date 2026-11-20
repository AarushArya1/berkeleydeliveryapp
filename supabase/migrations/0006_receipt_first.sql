-- Receipt first: after buying, the runner uploads a photo of the receipt and
-- enters its total. The final runner fee is worked out from that real price,
-- and the requester checks the photo and confirms the total before paying.
-- Until then, runner_fee_cents holds the estimate made at posting (from the
-- max price).
--
-- Run this in the Supabase SQL Editor after 0005_handoff_code.sql.

alter table public.requests add column if not exists receipt_photo_path text;
alter table public.requests add column if not exists receipt_confirmed_at timestamptz;   -- requester checked the photo against the total
