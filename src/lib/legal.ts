import { UNPAID_BAN_HOURS } from "./config";

// What each side agrees to, and what happens if they break it. Shown at
// sign-up, runner setup and in the Terms. Kept blunt on purpose.

export const REPORTABLE =
  "Every account is tied to a verified @berkeley.edu email, so anyone who breaks these rules can be reported to the Dart team and to UC Berkeley.";

export const REQUESTER_PROMISE = `You'll pay your runner the receipt total plus the runner fee, by Venmo or Zelle, when you get your items, then give them your 4-digit code. Your runner pays with their own money, so taking the items without paying is theft. ${REPORTABLE}`;

export const RUNNER_PROMISE = `You'll buy exactly what was asked for, keep the receipt, deliver within the delivery window, and only ask for the receipt total plus the fee in the app. ${REPORTABLE}`;

export const CONSEQUENCES = {
  requester: [
    ["Don't pay", `Your account is suspended right away and banned if you haven't paid within ${UNPAID_BAN_HOURS} hours. You can be reported to UC Berkeley.`],
    ["Cancel after it's bought", "You still owe the full amount. Not paying is treated the same as above."],
    ["Don't show up", "Your runner leaves it at your spot and you still owe the full amount."],
  ],
  runner: [
    ["Don't buy it in time", "The order goes back on the list for someone else."],
    ["Don't deliver, or deliver late", "The requester owes you nothing. Doing it on purpose gets you banned."],
    ["Charge more than the receipt", "Banned, and you can be reported to UC Berkeley."],
  ],
} as const;
