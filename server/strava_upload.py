#!/usr/bin/env python3
"""Tiny Strava upload service for Sonne la cloche.

Strava's OAuth needs a client secret, which cannot live in a web page. This
service holds it and does only this:

  GET  /api/strava/authorize?state=...&mobile=1   → redirect to Strava's consent page
  POST /api/strava/upload  {code, file, name, description, sportType, externalId}
       → exchange the code, upload the FIT file, set the activity's type,
         name and trainer flag, revoke the access, return the activity URL.

Nothing is stored: each access token is used for one upload and revoked.
Configuration comes from the environment (see STRAVA_* below). Standard
library only, so it runs on a bare Ubuntu with its own python3.
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable

STRAVA = "https://www.strava.com"
API = f"{STRAVA}/api/v3"
MAX_BODY_BYTES = 512 * 1024
SPORT_TYPES = {"VirtualRide", "Ride"}
UPLOAD_POLL_ATTEMPTS = 20
UPLOAD_POLL_DELAY_SEC = 1.0


@dataclass(frozen=True)
class Config:
    client_id: str
    client_secret: str
    redirect_uri: str

    @staticmethod
    def from_env() -> "Config":
        return Config(
            client_id=os.environ["STRAVA_CLIENT_ID"],
            client_secret=os.environ["STRAVA_CLIENT_SECRET"],
            redirect_uri=os.environ["STRAVA_REDIRECT_URI"],
        )


class UploadError(Exception):
    """A failure to report to the page, with a short machine-readable code."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code


# An HTTP call: (method, url, body, headers) -> (status, parsed JSON or None).
Http = Callable[[str, str, bytes | None, dict[str, str]], tuple[int, object]]


def urllib_http(method: str, url: str, body: bytes | None, headers: dict[str, str]) -> tuple[int, object]:
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    try:
        return status, json.loads(raw) if raw else None
    except ValueError:
        return status, None


def authorize_url(config: Config, state: str, mobile: bool) -> str:
    # The mobile endpoint opens the Strava app when it is installed.
    path = "/oauth/mobile/authorize" if mobile else "/oauth/authorize"
    query = urllib.parse.urlencode(
        {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": "activity:write",
            "state": state,
        }
    )
    return f"{STRAVA}{path}?{query}"


def multipart(fields: dict[str, str], file_name: str, file_bytes: bytes) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n".encode()
        + file_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


@dataclass(frozen=True)
class UploadRequest:
    code: str
    file: bytes
    name: str
    description: str
    sport_type: str
    external_id: str

    @staticmethod
    def parse(payload: object) -> "UploadRequest":
        if not isinstance(payload, dict):
            raise UploadError("bad_request")

        def text(key: str, limit: int) -> str:
            value = payload.get(key)
            if not isinstance(value, str):
                raise UploadError("bad_request", key)
            return value[:limit]

        code = text("code", 200)
        sport_type = text("sportType", 20)
        if not code:
            raise UploadError("bad_request", "code")
        if sport_type not in SPORT_TYPES:
            raise UploadError("bad_request", "sportType")
        try:
            file = base64.b64decode(text("file", MAX_BODY_BYTES), validate=True)
        except (binascii.Error, ValueError):
            raise UploadError("bad_request", "file") from None
        # A FIT file starts with a 12- or 14-byte header holding ".FIT".
        if len(file) < 14 or file[8:12] != b".FIT":
            raise UploadError("bad_request", "not a FIT file")
        return UploadRequest(
            code=code,
            file=file,
            name=text("name", 100),
            description=text("description", 1000),
            sport_type=sport_type,
            external_id=text("externalId", 100),
        )


def upload_activity(
    config: Config,
    request: UploadRequest,
    http: Http = urllib_http,
    sleep: Callable[[float], None] = time.sleep,
) -> str:
    """Runs the whole Strava exchange; returns the new activity's URL."""
    form = {"Content-Type": "application/x-www-form-urlencoded"}
    status, token = http(
        "POST",
        f"{STRAVA}/oauth/token",
        urllib.parse.urlencode(
            {
                "client_id": config.client_id,
                "client_secret": config.client_secret,
                "code": request.code,
                "grant_type": "authorization_code",
            }
        ).encode(),
        form,
    )
    if status != 200 or not isinstance(token, dict) or not isinstance(token.get("access_token"), str):
        raise UploadError("authorization_failed", str(status))
    auth = {"Authorization": f"Bearer {token['access_token']}"}

    try:
        body, content_type = multipart(
            {
                "data_type": "fit",
                "name": request.name,
                "description": request.description,
                "trainer": "1",
                "external_id": request.external_id,
            },
            "sonne-la-cloche.fit",
            request.file,
        )
        status, upload = http("POST", f"{API}/uploads", body, {**auth, "Content-Type": content_type})
        if status not in (200, 201) or not isinstance(upload, dict) or "id" not in upload:
            raise UploadError("upload_failed", str(status))

        activity_id = None
        for _ in range(UPLOAD_POLL_ATTEMPTS):
            if upload.get("error"):
                duplicate = "duplicate" in str(upload["error"]).lower()
                raise UploadError("duplicate" if duplicate else "upload_failed", str(upload["error"]))
            if upload.get("activity_id"):
                activity_id = upload["activity_id"]
                break
            sleep(UPLOAD_POLL_DELAY_SEC)
            status, upload = http("GET", f"{API}/uploads/{upload['id']}", None, auth)
            if status != 200 or not isinstance(upload, dict):
                raise UploadError("upload_failed", str(status))
        if activity_id is None:
            raise UploadError("upload_timeout")

        # What the file alone could not impose: the type, and the trainer flag.
        http(
            "PUT",
            f"{API}/activities/{activity_id}",
            json.dumps(
                {
                    "sport_type": request.sport_type,
                    "trainer": True,
                    "name": request.name,
                    "description": request.description,
                }
            ).encode(),
            {**auth, "Content-Type": "application/json"},
        )
        return f"{STRAVA}/activities/{activity_id}"
    finally:
        # Nothing to keep: give the access back right away.
        http(
            "POST",
            f"{STRAVA}/oauth/deauthorize",
            urllib.parse.urlencode({"access_token": token["access_token"]}).encode(),
            form,
        )


class Handler(BaseHTTPRequestHandler):
    config: Config
    server_version = "sonnelacloche-strava"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Paths only: never log query strings or bodies.
        print(f"{self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}", flush=True)

    def send_json(self, status: HTTPStatus, payload: dict[str, str]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        url = urllib.parse.urlsplit(self.path)
        if url.path != "/api/strava/authorize":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        query = urllib.parse.parse_qs(url.query)
        state = query.get("state", [""])[0]
        if not state or len(state) > 100:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_request"})
            return
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", authorize_url(self.config, state, query.get("mobile") == ["1"]))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/strava/upload":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "too_large"})
            return
        try:
            request = UploadRequest.parse(json.loads(self.rfile.read(length)))
            url = upload_activity(self.config, request)
        except ValueError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_request"})
        except UploadError as error:
            print(f"upload error: {error}", flush=True)
            status = HTTPStatus.BAD_REQUEST if error.code == "bad_request" else HTTPStatus.BAD_GATEWAY
            self.send_json(status, {"error": error.code})
        else:
            self.send_json(HTTPStatus.OK, {"url": url})


def main() -> None:
    Handler.config = Config.from_env()
    address = (os.environ.get("BIND", "127.0.0.1"), int(os.environ.get("PORT", "8787")))
    print(f"listening on {address[0]}:{address[1]}", flush=True)
    ThreadingHTTPServer(address, Handler).serve_forever()


if __name__ == "__main__":
    main()
