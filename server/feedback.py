"""Players' feedback, filed as issues in a private GitHub repository.

Players have no GitHub account, and do not expect their words to be public:
this service holds a token that can only write issues in a private repository
of the author, and files each message there.

  GET  /api/feedback/status   → {"configured": bool}
  POST /api/feedback  {message, rating, trainer, email, locale, source, bike, website}

Configuration: GITHUB_TOKEN (fine-grained, "Issues: write" on that repository
only) and GITHUB_FEEDBACK_REPO ("owner/name"). Both optional: without them the
page does not offer to send anything.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Callable

GITHUB_API = "https://api.github.com"
MAX_BODY_BYTES = 16 * 1024
MAX_MESSAGE = 2000
MAX_TRAINER = 80
MAX_EMAIL = 254
# Loose on purpose: the page already checks it, this only keeps junk out.
EMAIL_PATTERN = re.compile(r"[^@\s|`]+@[^@\s|`]+\.[^@\s|`]+")
TITLE_LENGTH = 70
RATINGS = {"bad": "😞", "ok": "😐", "great": "😄"}
LOCALES = {"fr", "en"}
SOURCES = {"home", "phone"}
# A sensor's protocol ("FTMS"…), "demo" or "none": nothing personal fits in it.
BIKE_PATTERN = re.compile(r"[A-Za-z ]{0,20}")
REPO_PATTERN = re.compile(r"[\w.-]+/[\w.-]+")

# An HTTP call: (method, url, body, headers) -> (status, parsed JSON or None).
Http = Callable[[str, str, bytes | None, dict[str, str]], tuple[int, object]]


class FeedbackError(Exception):
    """A failure to report to the page, with a short machine-readable code."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code


@dataclass(frozen=True)
class Config:
    token: str
    repo: str

    @property
    def complete(self) -> bool:
        return bool(self.token) and REPO_PATTERN.fullmatch(self.repo) is not None

    @staticmethod
    def from_env() -> "Config":
        return Config(
            token=os.environ.get("GITHUB_TOKEN", ""),
            repo=os.environ.get("GITHUB_FEEDBACK_REPO", ""),
        )


@dataclass(frozen=True)
class Feedback:
    message: str
    rating: str | None
    # Make and model, typed (or kept from the connected bike) by the player.
    trainer: str
    # Only if the player wants an answer; the repository is private.
    email: str
    locale: str
    source: str
    bike: str
    # Filled only by bots: the field is hidden from people.
    is_spam: bool

    @staticmethod
    def parse(payload: object) -> "Feedback":
        if not isinstance(payload, dict):
            raise FeedbackError("bad_request")

        def choice(key: str, allowed: set[str] | dict[str, str]) -> str:
            value = payload.get(key)
            if value not in allowed:
                raise FeedbackError("bad_request", key)
            return value

        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            raise FeedbackError("bad_request", "message")
        rating = payload.get("rating")
        if rating is not None and rating not in RATINGS:
            raise FeedbackError("bad_request", "rating")
        bike = payload.get("bike", "")
        if not isinstance(bike, str) or not BIKE_PATTERN.fullmatch(bike):
            raise FeedbackError("bad_request", "bike")
        trainer = payload.get("trainer", "")
        if not isinstance(trainer, str):
            raise FeedbackError("bad_request", "trainer")
        email = payload.get("email", "")
        if not isinstance(email, str):
            raise FeedbackError("bad_request", "email")
        email = email.strip()
        if email and (len(email) > MAX_EMAIL or not EMAIL_PATTERN.fullmatch(email)):
            raise FeedbackError("bad_request", "email")
        website = payload.get("website", "")
        return Feedback(
            message=message.strip()[:MAX_MESSAGE],
            rating=rating,
            trainer=" ".join(trainer.split())[:MAX_TRAINER],
            email=email,
            locale=choice("locale", LOCALES),
            source=choice("source", SOURCES),
            bike=bike,
            is_spam=bool(website),
        )


def fenced(text: str) -> str:
    """Quotes the message verbatim: no @mention pings, no images, no links."""
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}text\n{text}\n{fence}"


def cell(text: str) -> str:
    """Free text as inline code in a table cell: it cannot break the table out."""
    clean = " ".join(text.replace("`", "").replace("|", "/").split())
    return f"`{clean}`" if clean else "—"


def issue(feedback: Feedback, user_agent: str) -> dict[str, str]:
    first_line = feedback.message.splitlines()[0].strip()
    title = first_line if len(first_line) <= TITLE_LENGTH else first_line[: TITLE_LENGTH - 1] + "…"
    rating = f"{RATINGS[feedback.rating]} {feedback.rating}" if feedback.rating else "—"
    body = "\n".join(
        [
            fenced(feedback.message),
            "",
            "| | |",
            "|---|---|",
            f"| Rating | {rating} |",
            f"| Reply to | {feedback.email or '—'} |",
            f"| Sent from | {feedback.source} |",
            f"| Language | {feedback.locale} |",
            f"| Home trainer | {cell(feedback.trainer)} |",
            f"| Connection | {feedback.bike or '—'} |",
            f"| Browser | {cell(user_agent[:200])} |",
        ]
    )
    return {"title": f"{RATINGS.get(feedback.rating or '', '💬')} {title}", "body": body}


def file_issue(config: Config, feedback: Feedback, user_agent: str, http: Http) -> None:
    if feedback.is_spam:
        print("feedback: dropped (honeypot)", flush=True)
        return
    status, created = http(
        "POST",
        f"{GITHUB_API}/repos/{config.repo}/issues",
        json.dumps(issue(feedback, user_agent)).encode(),
        {
            "Authorization": f"Bearer {config.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "sonnelacloche-feedback",
        },
    )
    if status != 201:
        raise FeedbackError("send_failed", str(status))
    number = created.get("number") if isinstance(created, dict) else None
    print(f"feedback: issue #{number}", flush=True)
