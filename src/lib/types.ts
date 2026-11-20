import type { PayMethod } from "./config";

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
  venmo_username: string | null;
  zelle_contact: string | null;
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
  /** Estimated at posting (from the max price); final once the receipt is in (from the real price). */
  runner_fee_cents: number;
  distance_miles: number | null;
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
  /** Owed at handoff: receipt total + runner fee. */
  charged_cents: number | null;
  purchased_at: string | null;
  /** Receipt photo, uploaded right after buying, with the total the runner entered. */
  receipt_photo_path: string | null;
  /** The requester checked the receipt photo and confirmed the total. */
  receipt_confirmed_at: string | null;
  items_photo_path: string | null;
  picked_up_at: string | null;
  dropoff_photo_path: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropped_off_at: string | null;
  paid_reported_at: string | null;
  paid_method: PayMethod | null;
  auto_complete_at: string | null;
  completed_at: string | null;
  completion_method: "code" | "fallback" | "confirmed" | null;
  cancelled_at: string | null;
  cancelled_stage: "before_claim" | "after_claim" | "after_purchase" | "runner_late" | null;
  status_before_dispute: RequestStatus | null;
};

export type Dispute = {
  id: string;
  request_id: string;
  opened_by: string;
  /** "requester": something wrong with the order. "unpaid": the runner wasn't paid. */
  kind: "requester" | "unpaid";
  reason: string;
  details: string | null;
  status: "open" | "resolved";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
