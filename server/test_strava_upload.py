"""Tests for the Strava upload service: python3 -m unittest discover server"""

import base64
import json
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import strava_upload as su

CONFIG = su.Config("12345", "s3cret", "https://sonnelacloche.enavarro.eu/strava/")
FIT = bytes([14, 0x20, 0, 0, 0, 0, 0, 0]) + b".FIT" + b"\x00" * 20


def valid_payload(**overrides):
    payload = {
        "code": "abc",
        "file": base64.b64encode(FIT).decode(),
        "name": "Sonne la cloche !",
        "description": "2e sur 6",
        "sportType": "VirtualRide",
        "externalId": "slc-1",
    }
    payload.update(overrides)
    return payload


class FakeStrava:
    """Answers like Strava and records every call."""

    def __init__(self, token_status=200, upload_error=None, polls_before_ready=1):
        self.calls = []
        self.token_status = token_status
        self.upload_error = upload_error
        self.polls_left = polls_before_ready

    def __call__(self, method, url, body, headers):
        self.calls.append((method, url, body, headers))
        path = urllib.parse.urlsplit(url).path
        if path == "/oauth/token":
            if self.token_status != 200:
                return self.token_status, {"message": "Bad Request"}
            return 200, {"access_token": "tok"}
        if path == "/api/v3/uploads":
            return 201, {"id": 7, "activity_id": None, "error": None}
        if path == "/api/v3/uploads/7":
            if self.upload_error:
                return 200, {"id": 7, "activity_id": None, "error": self.upload_error}
            self.polls_left -= 1
            return 200, {"id": 7, "activity_id": 99 if self.polls_left < 0 else None, "error": None}
        if path == "/api/v3/activities/99":
            return 200, {"id": 99}
        if path == "/oauth/deauthorize":
            return 200, {}
        raise AssertionError(f"unexpected call {method} {url}")

    def paths(self):
        return [f"{m} {urllib.parse.urlsplit(u).path}" for m, u, _, _ in self.calls]


class UploadRequestTests(unittest.TestCase):
    def test_accepts_a_valid_request(self):
        request = su.UploadRequest.parse(valid_payload())
        self.assertEqual(request.file, FIT)
        self.assertEqual(request.sport_type, "VirtualRide")

    def test_rejects_bad_input(self):
        for payload in (
            None,
            valid_payload(code=""),
            valid_payload(code=12),
            valid_payload(sportType="Run"),
            valid_payload(sportType="Ride"),
            valid_payload(file="not base64!"),
            valid_payload(file=base64.b64encode(b"hello, this is not a fit file").decode()),
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(su.UploadError) as caught:
                    su.UploadRequest.parse(payload)
                self.assertEqual(caught.exception.code, "bad_request")

    def test_truncates_long_texts(self):
        request = su.UploadRequest.parse(valid_payload(name="x" * 500))
        self.assertEqual(len(request.name), 100)


class UploadActivityTests(unittest.TestCase):
    def upload(self, fake):
        return su.upload_activity(CONFIG, su.UploadRequest.parse(valid_payload()), fake, sleep=lambda _: None)

    def test_whole_exchange(self):
        fake = FakeStrava(polls_before_ready=2)
        url = self.upload(fake)
        self.assertEqual(url, "https://www.strava.com/activities/99")
        self.assertEqual(
            fake.paths(),
            [
                "POST /oauth/token",
                "POST /api/v3/uploads",
                "GET /api/v3/uploads/7",
                "GET /api/v3/uploads/7",
                "GET /api/v3/uploads/7",
                "PUT /api/v3/activities/99",
                "POST /oauth/deauthorize",
            ],
        )

    def test_exchanges_the_code_with_the_secret(self):
        fake = FakeStrava()
        self.upload(fake)
        form = urllib.parse.parse_qs(fake.calls[0][2].decode())
        self.assertEqual(form["client_secret"], ["s3cret"])
        self.assertEqual(form["code"], ["abc"])

    def test_uploads_the_fit_file_as_a_trainer_ride(self):
        fake = FakeStrava()
        self.upload(fake)
        _, _, body, headers = fake.calls[1]
        self.assertEqual(headers["Authorization"], "Bearer tok")
        self.assertIn(b'name="data_type"\r\n\r\nfit', body)
        self.assertIn(b'name="trainer"\r\n\r\n1', body)
        self.assertIn(FIT, body)

    def test_sets_the_type_the_file_could_not(self):
        fake = FakeStrava()
        self.upload(fake)
        update = next(c for c in fake.calls if c[0] == "PUT")
        self.assertEqual(
            json.loads(update[2]),
            {"sport_type": "VirtualRide", "trainer": True, "name": "Sonne la cloche !", "description": "2e sur 6"},
        )

    def test_refused_code(self):
        fake = FakeStrava(token_status=400)
        with self.assertRaises(su.UploadError) as caught:
            self.upload(fake)
        self.assertEqual(caught.exception.code, "authorization_failed")
        self.assertEqual(fake.paths(), ["POST /oauth/token"])

    def test_duplicate_activity_still_revokes_access(self):
        fake = FakeStrava(upload_error="activity.fit duplicate of activity 42")
        with self.assertRaises(su.UploadError) as caught:
            self.upload(fake)
        self.assertEqual(caught.exception.code, "duplicate")
        self.assertEqual(fake.paths()[-1], "POST /oauth/deauthorize")

    def test_gives_up_when_strava_takes_too_long(self):
        fake = FakeStrava(polls_before_ready=1000)
        with self.assertRaises(su.UploadError) as caught:
            self.upload(fake)
        self.assertEqual(caught.exception.code, "upload_timeout")
        self.assertEqual(fake.paths()[-1], "POST /oauth/deauthorize")


class HttpServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        su.Handler.config = CONFIG
        su.Handler.log_message = lambda *args: None
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), su.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def request(self, method, path, body=None):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        request = urllib.request.Request(self.base + path, data=body, method=method)
        try:
            with opener.open(request) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.headers, error.read()

    def test_authorize_redirects_to_strava(self):
        status, headers, _ = self.request("GET", "/api/strava/authorize?state=xyz&mobile=1")
        self.assertEqual(status, 302)
        location = urllib.parse.urlsplit(headers["Location"])
        self.assertEqual(location.path, "/oauth/mobile/authorize")
        query = urllib.parse.parse_qs(location.query)
        self.assertEqual(query["client_id"], ["12345"])
        self.assertEqual(query["state"], ["xyz"])
        self.assertEqual(query["scope"], ["activity:write"])
        self.assertNotIn("s3cret", headers["Location"])

    def test_authorize_without_credentials_comes_back_with_an_error(self):
        su.Handler.config = su.Config("", "", CONFIG.redirect_uri)
        try:
            status, headers, _ = self.request("GET", "/api/strava/authorize?state=xyz")
        finally:
            su.Handler.config = CONFIG
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "/strava/?error=not_configured&state=xyz")

    def test_status_says_whether_publishing_works(self):
        status, _, body = self.request("GET", "/api/strava/status")
        self.assertEqual((status, json.loads(body)), (200, {"configured": True}))
        su.Handler.config = su.Config("", "", CONFIG.redirect_uri)
        try:
            _, _, body = self.request("GET", "/api/strava/status")
        finally:
            su.Handler.config = CONFIG
        self.assertEqual(json.loads(body), {"configured": False})

    def test_authorize_needs_a_state(self):
        status, _, _ = self.request("GET", "/api/strava/authorize")
        self.assertEqual(status, 400)

    def test_authorize_carries_a_game_sized_state(self):
        state = "A-b_9" * 160 + ".43.90000,-1.90000"
        status, headers, _ = self.request("GET", f"/api/strava/authorize?state={urllib.parse.quote(state)}")
        self.assertEqual(status, 302)
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(headers["Location"]).query)
        self.assertEqual(query["state"], [state])

    def test_authorize_rejects_odd_states(self):
        for state in ("<script>", "a" * 2001, "a b"):
            with self.subTest(state=state):
                status, _, _ = self.request("GET", f"/api/strava/authorize?state={urllib.parse.quote(state)}")
                self.assertEqual(status, 400)

    def test_rejects_bodies_that_are_too_large_or_not_json(self):
        status, _, _ = self.request("POST", "/api/strava/upload", b"x" * (su.MAX_BODY_BYTES + 1))
        self.assertEqual(status, 413)
        status, _, body = self.request("POST", "/api/strava/upload", b"not json")
        self.assertEqual((status, json.loads(body)), (400, {"error": "bad_request"}))

    def test_unknown_paths(self):
        self.assertEqual(self.request("GET", "/api/strava/other")[0], 404)
        self.assertEqual(self.request("POST", "/api/strava/other", b"{}")[0], 404)


if __name__ == "__main__":
    unittest.main()
