export type ProfileStatus = "active" | "suspended" | "banned";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  dorm: string | null;
  phone: string | null;
  default_spot: string | null;
  sms_consent_at: string | null;
  tos_accepted_at: string | null;
  home_screen_at: string | null;
  runner_terms_accepted_at: string | null;
  payouts_ready_at: string | null;
  card_issued_at: string | null;
  runner_budget_cents: number | null;
  is_admin: boolean;
  status: ProfileStatus;
  no_show_count: number;
  created_at: string;
};

export type RequestStatus =
  | "open"
  | "claimed"
  | "purchased"
  | "delivering"
  | "dropped_off"
  | "completed"
  | "cancelled"
  | "expired"
  | "disputed"
  | "refunded";

export type DartRequest = {
  id: string;
  requester_id: string;
  items: string;
  notes: string | null;
  store: string;
  dropoff_zone: string;
  max_price_cents: number;
  runner_fee_cents: number;
  dart_fee_cents: number;
  hold_cents: number;
  status: RequestStatus;
  expires_at: string;
  created_at: string;
  runner_id: string | null;
  claimed_at: string | null;
  eta_at: string | null;
  deliver_by: string | null;
  deliver_warned_at: string | null;
  overdue_notified_at: string | null;
  purchase_cents: number | null;
  purchase_merchant: string | null;
  processing_cents: number | null;
  charged_cents: number | null;
  purchased_at: string | null;
  items_photo_path: string | null;
  picked_up_at: string | null;
  dropoff_photo_path: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropped_off_at: string | null;
  auto_release_at: string | null;
  completed_at: string | null;
  completion_method: "code" | "fallback" | "confirmed" | null;
  cancelled_at: string | null;
  cancelled_stage: "before_claim" | "after_claim" | "after_purchase" | null;
  status_before_dispute: RequestStatus | null;
  payout_status: "none" | "pending" | "released" | "withheld";
  payout_released_at: string | null;
};

/**
 * A runner's one Dart virtual card, created at runner sign-up. The money and
 * restrictions live on its loads (one per claimed order); with no open loads
 * it's locked at $0.
 */
export type Card = {
  id: string;
  runner_id: string;
  last4: string;
  exp: string;
  status: "active" | "frozen";
  frozen_at: string | null;
  created_at: string;
};

/** One order's load on a runner's card (the per-claim history). */
export type CardLoad = {
  id: string;
  card_id: string;
  runner_id: string;
  request_id: string;
  amount_cents: number;
  store: string;
  allowed_category: string;
  status: "loaded" | "spent" | "unloaded";
  unload_reason: string | null;
  armed_until: string | null;
  loaded_at: string;
  closed_at: string | null;
};

export type CardAuthorization = {
  id: string;
  card_id: string;
  card_load_id: string | null;
  runner_id: string;
  request_id: string | null;
  amount_cents: number;
  merchant: string;
  merchant_category: string;
  approved: boolean;
  decline_reason: string | null;
  created_at: string;
};

export type Dispute = {
  id: string;
  request_id: string;
  opened_by: string;
  reason: string;
  details: string | null;
  status: "open" | "refunded" | "rejected";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
