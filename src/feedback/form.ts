// "Your opinion?": a short form whose messages reach the author only (the
// server files them in a private GitHub repository, see server/feedback.py).
// Plain DOM, like the phone page it also lives on.

import i18n from "i18next";
import type { Locale } from "../i18n/locales";

export const RATINGS = ["bad", "ok", "great"] as const;
export type Rating = (typeof RATINGS)[number];
const RATING_EMOJI: Record<Rating, string> = { bad: "😞", ok: "😐", great: "😄" };
export const MAX_MESSAGE = 2000;
export const MAX_TRAINER = 80;
export const MAX_EMAIL = 254;

export interface FeedbackContext {
  locale: Locale;
  source: "home" | "phone";
  /** The sensor's protocol ("FTMS"…), "demo" or "none". */
  bike: string;
  /** The connected bike's name, to start the "home trainer" field with. */
  trainer?: string;
}

/** Whether this site can send feedback: not without the optional server. */
export async function feedbackAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/feedback/status");
    if (!response.ok) return false;
    const status = (await response.json()) as { configured?: unknown };
    return status.configured === true;
  } catch {
    return false;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** A labelled input with its help line, read out with it. */
function field(input: HTMLInputElement, label: string, help: string): HTMLElement[] {
  const helpLine = el("p", { className: "help", id: `feedback-${input.name}-help` }, help);
  input.setAttribute("aria-describedby", helpLine.id);
  return [el("label", { className: "field" }, el("span", {}, label), input), helpLine];
}

/**
 * The form; `onBack`, when given, is offered once the message is sent (the
 * standalone page closes its tab, back to the game).
 */
export function feedbackForm(context: FeedbackContext, onBack?: () => void): HTMLFormElement {
  const t = i18n.t;
  let rating: Rating | null = null;

  const ratingButtons = RATINGS.map((value) => {
    const button = el("button", { type: "button", className: "rating" }, RATING_EMOJI[value]);
    button.setAttribute("aria-label", t(`feedback.rating.${value}`));
    button.setAttribute("aria-pressed", "false");
    button.onclick = () => {
      rating = rating === value ? null : value;
      for (const [i, other] of ratingButtons.entries()) {
        other.setAttribute("aria-pressed", String(RATINGS[i] === rating));
      }
    };
    return button;
  });
  const ratingGroup = el("div", { className: "ratings" }, ...ratingButtons);
  ratingGroup.setAttribute("role", "group");
  ratingGroup.setAttribute("aria-label", t("feedback.ratingLabel"));

  const message = el("textarea", {
    name: "message",
    rows: 4,
    maxLength: MAX_MESSAGE,
    required: true,
    placeholder: t("feedback.placeholder"),
  });
  message.setAttribute("aria-label", t("feedback.messageLabel"));
  const trainer = el("input", {
    type: "text",
    name: "trainer",
    maxLength: MAX_TRAINER,
    autocomplete: "off",
    value: context.trainer ?? "",
    placeholder: t("feedback.trainerPlaceholder"),
  });
  const email = el("input", {
    type: "email",
    name: "email",
    maxLength: MAX_EMAIL,
    autocomplete: "email",
    placeholder: t("feedback.emailPlaceholder"),
  });
  // Hidden from people (off screen, out of the tab order): only bots fill it.
  const honeypot = el("input", {
    type: "text",
    name: "website",
    tabIndex: -1,
    autocomplete: "off",
  });
  const trap = el("label", { className: "trap" }, "Website ", honeypot);
  trap.setAttribute("aria-hidden", "true");

  const send = el("button", { type: "submit", className: "primary" }, t("feedback.send"));
  const status = el("p", { className: "status", hidden: true });
  status.setAttribute("role", "status");

  const form = el(
    "form",
    { className: "feedback" },
    el("p", {}, t("feedback.intro")),
    ratingGroup,
    message,
    ...field(trainer, t("feedback.trainerLabel"), t("feedback.trainerHelp")),
    ...field(email, t("feedback.emailLabel"), t("feedback.emailHelp")),
    trap,
    el("p", { className: "help" }, t("feedback.privacy")),
    el("div", { className: "row" }, send),
    status,
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!message.value.trim()) return;
    send.disabled = true;
    status.hidden = false;
    status.className = "status";
    status.textContent = t("feedback.sending");
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.value,
        rating,
        trainer: trainer.value,
        email: email.value.trim(),
        locale: context.locale,
        source: context.source,
        bike: context.bike,
        website: honeypot.value,
      }),
    })
      .then((response) => response.ok)
      .catch(() => false)
      .then((sent) => {
        if (sent) {
          form.replaceChildren(el("p", { className: "thanks" }, t("feedback.thanks")));
          if (onBack) {
            const back = el(
              "button",
              { type: "button", className: "secondary" },
              t("feedback.back"),
            );
            back.onclick = onBack;
            form.append(el("div", { className: "row" }, back));
          }
          return;
        }
        send.disabled = false;
        status.className = "status failed";
        status.textContent = t("feedback.failed");
      });
  };
  return form;
}
