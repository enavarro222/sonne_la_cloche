"""Tests for the feedback service: python3 -m unittest discover server"""

import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import feedback as fb
import strava_upload as su

CONFIG = fb.Config("gh-token", "enavarro222/sonne_la_cloche-feedback")


def valid_payload(**overrides):
    payload = {
        "message": "Super jeu !\nMais le vélo s'est déconnecté une fois.",
        "rating": "great",
        "trainer": "Elite Suito",
        "email": "parent@example.org",
        "locale": "fr",
        "source": "phone",
        "bike": "FTMS",
        "website": "",
    }
    payload.update(overrides)
    return payload


class FakeGitHub:
    """Answers like GitHub's issue API and records every call."""

    def __init__(self, status=201):
        self.status = status
        self.calls = []

    def __call__(self, method, url, body, headers):
        self.calls.append((method, url, json.loads(body), headers))
        return self.status, {"number": 1} if self.status == 201 else {"message": "Bad credentials"}


class ParseTests(unittest.TestCase):
    def test_accepts_a_complete_message(self):
        feedback = fb.Feedback.parse(valid_payload())
        self.assertEqual(feedback.rating, "great")
        self.assertEqual(feedback.source, "phone")
        self.assertFalse(feedback.is_spam)

    def test_rating_trainer_and_bike_are_optional(self):
        payload = valid_payload(rating=None)
        del payload["bike"], payload["trainer"], payload["email"]
        feedback = fb.Feedback.parse(payload)
        self.assertIsNone(feedback.rating)
        self.assertEqual((feedback.trainer, feedback.email, feedback.bike), ("", "", ""))
        body = fb.issue(feedback, "")["body"]
        self.assertIn("| Home trainer | — |", body)
        self.assertIn("| Reply to | — |", body)
        self.assertEqual(fb.Feedback.parse(valid_payload(email="  ")).email, "")

    def test_keeps_free_text_inside_its_table_cell(self):
        feedback = fb.Feedback.parse(valid_payload(trainer="  KICKR | `v5`\n" + "x" * 200))
        self.assertEqual(len(feedback.trainer), fb.MAX_TRAINER)
        body = fb.issue(feedback, "Agent | with `ticks`")["body"]
        self.assertIn("| Home trainer | `KICKR / v5 xxx", body)
        self.assertIn("| Browser | `Agent / with ticks` |", body)

    def test_trims_and_caps_the_message(self):
        feedback = fb.Feedback.parse(valid_payload(message="  " + "a" * 5000 + "  "))
        self.assertEqual(feedback.message, "a" * fb.MAX_MESSAGE)

    def test_rejects_what_the_page_never_sends(self):
        cases = {
            "empty message": valid_payload(message="   "),
            "unknown rating": valid_payload(rating="meh"),
            "unknown locale": valid_payload(locale="de"),
            "unknown source": valid_payload(source="tv"),
            "odd bike": valid_payload(bike="<script>"),
            "trainer not text": valid_payload(trainer=42),
            "not an email": valid_payload(email="parent at example"),
            "email breaking the table": valid_payload(email="a|b@example.org"),
            "email too long": valid_payload(email="a" * 250 + "@example.org"),
            "not an object": [],
        }
        for name, payload in cases.items():
            with self.subTest(name), self.assertRaises(fb.FeedbackError):
                fb.Feedback.parse(payload)

    def test_a_filled_honeypot_marks_spam(self):
        self.assertTrue(fb.Feedback.parse(valid_payload(website="http://spam")).is_spam)


class IssueTests(unittest.TestCase):
    def test_files_the_message_with_its_context(self):
        github = FakeGitHub()
        fb.file_issue(CONFIG, fb.Feedback.parse(valid_payload()), "Mozilla/5.0 Android", github)
        [(method, url, issue, headers)] = github.calls
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://api.github.com/repos/enavarro222/sonne_la_cloche-feedback/issues")
        self.assertEqual(headers["Authorization"], "Bearer gh-token")
        self.assertEqual(issue["title"], "😄 Super jeu !")
        self.assertIn("Mais le vélo s'est déconnecté une fois.", issue["body"])
        self.assertIn("| Home trainer | `Elite Suito` |", issue["body"])
        self.assertIn("| Reply to | parent@example.org |", issue["body"])
        self.assertIn("| Connection | FTMS |", issue["body"])
        self.assertIn("Mozilla/5.0 Android", issue["body"])

    def test_quotes_the_message_so_it_cannot_ping_or_embed(self):
        message = "@someone look ![x](http://img) ```code```"
        issue = fb.issue(fb.Feedback.parse(valid_payload(message=message)), "")
        self.assertTrue(issue["body"].startswith(f"````text\n{message}\n````"))

    def test_shortens_long_titles(self):
        issue = fb.issue(fb.Feedback.parse(valid_payload(message="x" * 200, rating=None)), "")
        self.assertEqual(issue["title"], "💬 " + "x" * (fb.TITLE_LENGTH - 1) + "…")

    def test_drops_spam_without_calling_github(self):
        github = FakeGitHub()
        fb.file_issue(CONFIG, fb.Feedback.parse(valid_payload(website="spam")), "", github)
        self.assertEqual(github.calls, [])

    def test_reports_a_refused_issue(self):
        with self.assertRaises(fb.FeedbackError) as caught:
            fb.file_issue(CONFIG, fb.Feedback.parse(valid_payload()), "", FakeGitHub(status=401))
        self.assertEqual(caught.exception.code, "send_failed")

    def test_needs_a_token_and_a_repository(self):
        self.assertTrue(CONFIG.complete)
        self.assertFalse(fb.Config("", CONFIG.repo).complete)
        self.assertFalse(fb.Config("gh-token", "").complete)
        self.assertFalse(fb.Config("gh-token", "not a repo").complete)


class HttpServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        su.Handler.config = su.Config("12345", "s3cret", "https://example.org/strava/")
        su.Handler.log_message = lambda *args: None
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), su.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        su.Handler.feedback = CONFIG
        self.github = FakeGitHub()
        original = su.urllib_http
        su.urllib_http = self.github
        self.addCleanup(setattr, su, "urllib_http", original)
        self.addCleanup(setattr, su.Handler, "feedback", fb.Config("", ""))

    def request(self, method, path, body=None):
        request = urllib.request.Request(self.base + path, data=body, method=method)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_status_says_whether_feedback_can_be_sent(self):
        self.assertEqual(self.request("GET", "/api/feedback/status"), (200, {"configured": True}))
        su.Handler.feedback = fb.Config("", "")
        self.assertEqual(self.request("GET", "/api/feedback/status"), (200, {"configured": False}))

    def test_sends_a_message(self):
        status, body = self.request("POST", "/api/feedback", json.dumps(valid_payload()).encode())
        self.assertEqual((status, body), (200, {"sent": True}))
        self.assertEqual(len(self.github.calls), 1)

    def test_refuses_without_configuration(self):
        su.Handler.feedback = fb.Config("", "")
        status, body = self.request("POST", "/api/feedback", json.dumps(valid_payload()).encode())
        self.assertEqual((status, body), (503, {"error": "not_configured"}))

    def test_rejects_bad_bodies(self):
        status, _ = self.request("POST", "/api/feedback", b"x" * (fb.MAX_BODY_BYTES + 1))
        self.assertEqual(status, 413)
        self.assertEqual(self.request("POST", "/api/feedback", b"not json"), (400, {"error": "bad_request"}))
        bad = json.dumps(valid_payload(locale="de")).encode()
        self.assertEqual(self.request("POST", "/api/feedback", bad), (400, {"error": "bad_request"}))

    def test_reports_github_failures(self):
        su.urllib_http = FakeGitHub(status=401)
        status, body = self.request("POST", "/api/feedback", json.dumps(valid_payload()).encode())
        self.assertEqual((status, body), (502, {"error": "send_failed"}))


if __name__ == "__main__":
    unittest.main()
