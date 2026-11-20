import Link from "next/link";
import { Logo } from "@/components/logo";
import { Notice } from "@/components/ui";
import {
  AUTO_COMPLETE_HOURS,
  DELIVERY_WINDOW_MINUTES,
  DISPUTE_WINDOW_HOURS,
  LIMITS,
  UNPAID_BAN_HOURS,
} from "@/lib/config";
import { money } from "@/lib/format";
import { CONSEQUENCES, REPORTABLE, REQUESTER_PROMISE, RUNNER_PROMISE } from "@/lib/legal";

export const metadata = { title: "Terms of Service · Dart" };

const sections: [string, string[]][] = [
  [
    "Who can use Dart",
    [
      "Dart is open only to current UC Berkeley students with a verified @berkeley.edu email address.",
      "Every account can post requests (Requester) and fulfill them (Runner). Everyone adds a Venmo username or Zelle phone/email, used only to pay and get paid on Dart orders.",
    ],
  ],
  [
    "How payment works",
    [
      "Dart does not handle money. Your runner buys your items with their own money, and you pay them back directly by Venmo or Zelle.",
      `You pay the receipt total plus the runner fee shown in the app, when you get your items. The fee is set by Dart from the distance from the store to your drop-off area and the item price: you see an estimate when you post, and the exact amount as soon as your runner sends the receipt. Check the receipt photo and confirm the total before paying; if it doesn't match, report it instead of paying. Orders must be at least ${money(LIMITS.minOrderCents)} in items and, during launch, no more than ${money(LIMITS.launchMaxCents)}. Your runner can't spend more than your maximum, and you never owe more than the receipt total plus the fee.`,
      `When your runner claims your order you get a 4-digit handoff code. After paying, tap "I paid" and give your runner the code; entering it confirms you paid and got your items, and completes the order. If you paid but the code isn't entered and your runner doesn't confirm or report a problem within ${AUTO_COMPLETE_HOURS} hours, the order completes automatically.`,
      "Dart takes no fee during the early pilot. Dart is not a party to payments between users and can't refund them, but will step in when either side breaks these terms.",
    ],
  ],
  [
    "Cancellations",
    [
      "You can cancel for free until your runner buys the items.",
      "If you cancel after they're bought, you still owe the full amount. If you don't pay, your runner may return the items using their receipt, and your account is banned.",
      `If your runner hasn't delivered within ${DELIVERY_WINDOW_MINUTES} minutes of claiming your order, you can cancel and owe nothing.`,
    ],
  ],
  [
    "Handoff",
    [
      "Meet your runner at your drop-off spot, pay them, then give them your code. Only give the code once you've paid and have your items.",
      "If you don't show up, the runner may leave your order at the drop-off spot with a photo. You still owe the full amount.",
    ],
  ],
  ["What requesters agree to", [REQUESTER_PROMISE]],
  [
    "Runners",
    [
      `Once you claim an order you have ${DELIVERY_WINDOW_MINUTES} minutes, counted from the moment you claim it, to buy the items and hand them off. If you haven't bought them in that time, the order goes back on the shopping list. If you deliver after the window, the requester may cancel and owe nothing.`,
      "You set the most you're willing to front for one order. You'll only see and claim orders at or under it.",
      "Right after buying, upload a photo of the receipt and enter its exact total. The final runner fee is set from that price, and the requester checks the photo and confirms the total before paying. Entering a total that doesn't match the receipt gets you banned. Keep the paper receipt until you're paid, so you can return the items if the requester doesn't pay.",
      "At handoff, get paid first, then enter the requester's code.",
      RUNNER_PROMISE,
    ],
  ],
  [
    "Restricted items",
    ["Alcohol, tobacco, vapes, prescription drugs and anything age-restricted cannot be requested or purchased."],
  ],
  [
    "Problems and enforcement",
    [
      `Runners: if a requester doesn't pay, report it from the order. Their account is suspended immediately, and banned if they haven't paid within ${UNPAID_BAN_HOURS} hours. Paying and having the runner confirm lifts the suspension.`,
      `Requesters: if items are wrong, damaged or missing, or a runner asks for more than the receipt plus the fee, report it from the order (up to ${DISPUTE_WINDOW_HOURS} hours after it completes). The Dart team reviews every report and can suspend or ban either side.`,
      REPORTABLE,
      "Dart keeps order records and will share them with the other party, UC Berkeley or law enforcement when someone takes items or money without paying or delivering.",
    ],
  ],
  [
    "Privacy",
    [
      "Requests are shown only to verified students. Your name and exact drop-off spot are hidden until a runner claims your order.",
      "Your Venmo or Zelle is shown only to the other person on an order you're both part of.",
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
        <section className="mt-8 rounded-2xl border border-danger/25 bg-danger-soft/40 p-5">
          <h2 className="text-lg font-bold">If someone breaks the deal</h2>
          <p className="mt-1 text-sm text-muted">{REPORTABLE}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Requesters", CONSEQUENCES.requester],
                ["Runners", CONSEQUENCES.runner],
              ] as const
            ).map(([who, rows]) => (
              <dl key={who} className="space-y-2 text-sm">
                <p className="text-[13px] font-bold uppercase tracking-wider text-muted">{who}</p>
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-bold text-ink">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </section>
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
