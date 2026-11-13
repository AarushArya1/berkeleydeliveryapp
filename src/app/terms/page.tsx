import Link from "next/link";
import { Logo } from "@/components/logo";
import { Notice } from "@/components/ui";
import { DELIVERY_WINDOW_MINUTES, FALLBACK_RELEASE_HOURS, LIMITS } from "@/lib/config";
import { money } from "@/lib/format";
import { RUNNER_CARD_WARNING } from "@/lib/legal";

export const metadata = { title: "Terms of Service · Dart" };

const sections: [string, string[]][] = [
  [
    "Who can use Dart",
    [
      "Dart is open only to current UC Berkeley students with a verified @berkeley.edu email address.",
      "Every account can post requests (Requester) and fulfill them (Runner). Runners must complete identity verification and payout setup through Stripe before their first order.",
    ],
  ],
  [
    "Requests and payment",
    [
      `When you post a request, Dart places a hold on your card for your maximum item price plus the runner fee, Dart fee and card processing. Orders must be at least ${money(LIMITS.minOrderCents)} in items and, during launch, no more than ${money(LIMITS.launchMaxCents)}.`,
      "You are charged when the runner's Dart card purchase is approved: the exact purchase amount plus fees. The rest of the hold is released. If nobody claims your request before it closes, the hold is released and you are not charged.",
      "Payments are processed by Stripe. Dart never stores your card number.",
    ],
  ],
  [
    "Cancellations",
    [
      "You can cancel for free until the runner's Dart card purchase goes through.",
      "If you cancel after the purchase, you pay for the items and fees in full and the runner receives their fee.",
    ],
  ],
  [
    "Handoff",
    [
      "When a runner claims your order you receive a 4-digit code. Give it to your runner at the drop-off spot.",
      `If you don't show up or won't give the code, the runner may leave the order at the drop-off spot with a photo. The runner fee is then released after ${FALLBACK_RELEASE_HOURS} hours unless you open a dispute. You are still charged. Repeat no-shows are banned.`,
    ],
  ],
  [
    "Restricted items",
    ["Alcohol, tobacco, vapes, prescription drugs and anything age-restricted cannot be requested or purchased."],
  ],
  [
    "Problems and refunds",
    [
      "If an item is damaged, lost, or never delivered, open a dispute from the order page. Approved refunds are paid from the Dart reserve.",
      "Runners who don't deliver or keep items receive no fee, have their Dart card frozen and their account suspended pending review.",
    ],
  ],
  [
    "Runners and the Dart card",
    [
      "Each runner gets one Dart virtual card. It holds no money until you claim an order. Each claimed order is loaded onto it separately: up to that requester's maximum price, at that order's store, for a single purchase. A purchase pays for the order loaded for that store; if you have more than one order at the same store, you must choose which one you're paying for first. After its purchase, or if the order is cancelled, released or runs out of time, that order comes off the card. With no orders on it, the card is locked.",
      `Once you claim an order you have ${DELIVERY_WINDOW_MINUTES} minutes to buy the items and hand them off. If you haven't bought them in that time, the order is released back to the wishlist and taken off your Dart card.`,
      RUNNER_CARD_WARNING,
    ],
  ],
  [
    "Privacy",
    [
      "Requests are shown only to verified students. Your name and exact drop-off spot are hidden until a runner claims your order.",
      "We use your phone number to text you about your orders. Reply STOP to opt out.",
    ],
  ],
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white">
      <div className="pt-safe mx-auto max-w-2xl px-5 pb-16">
        <div className="pt-6">
          <Link href="/">
            <Logo size={28} />
          </Link>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Terms of Service</h1>
        <Notice tone="warn" className="mt-4">
          Draft for the MVP pilot. Have a lawyer review before public launch.
        </Notice>
        <div className="mt-8 space-y-8">
          {sections.map(([title, paras]) => (
            <section key={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-muted">
                {paras.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
