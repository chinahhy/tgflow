#!/usr/bin/env python3
"""Verify default HTTP/HTTPS access and explicit cookie overrides on a disposable image."""
import argparse
import base64
import http.client
import http.cookiejar
import http.cookies
import json
import os
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request


class Client:
    def __init__(self, base, context):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
            urllib.request.HTTPSHandler(context=context),
        )

    def request(self, path, data=None, origin=None, headers=None, method=None):
        request_headers = {"Origin": origin or self.base, **(headers or {})}
        if data is not None:
            request_headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path,
            data=None if data is None else json.dumps(data).encode(), headers=request_headers, method=method)
        try:
            response = self.opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = {}
            return response.status, body, response.headers

    def csrf(self):
        return next(cookie.value for cookie in self.jar if cookie.name == "tf_csrf")

    def assert_legacy_session(self, secure):
        assert self.request("/api/telegrams/change?telegramId=", {}, headers={"X-CSRF-Token": self.csrf()})[0] == 200
        for name in ["tf", "tf_admin", "tf_csrf"]:
            cookie = next(cookie for cookie in self.jar if cookie.name == name)
            assert cookie.secure == secure, f"Unexpected Secure attribute on {name}"

    def websocket_status(self, context, origin=None):
        req = urllib.request.Request(self.base + "/ws")
        self.jar.add_cookie_header(req)
        target = urllib.parse.urlsplit(self.base)
        connection = (http.client.HTTPSConnection(target.hostname, target.port, context=context, timeout=15)
                      if target.scheme == "https" else http.client.HTTPConnection(target.hostname, target.port, timeout=15))
        try:
            connection.request("GET", "/ws", headers={
                "Host": target.netloc, "Origin": origin or self.base,
                "Cookie": req.get_header("Cookie", ""), "Connection": "Upgrade", "Upgrade": "websocket",
                "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": base64.b64encode(os.urandom(16)).decode(),
            })
            return connection.getresponse().status
        finally:
            connection.close()


def assert_cookies(headers, secure):
    cookies = http.cookies.SimpleCookie()
    for header in headers.get_all("Set-Cookie", []):
        cookies.load(header)
    for name in ["tf_admin", "tf_csrf"]:
        assert name in cookies, f"Missing {name} cookie"
        assert bool(cookies[name]["secure"]) == secure, f"Wrong Secure flag on {name}"
        assert cookies[name]["samesite"].lower() == "strict"
    assert cookies["tf_admin"]["httponly"]
    assert not cookies["tf_csrf"]["httponly"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--ca-file", required=True)
    parser.add_argument("--cookie-mode", choices=["auto", "true", "false"], default="auto")
    parser.add_argument("--https-url", default="https://127.0.0.1:7443")
    parser.add_argument("--http-url", default="http://127.0.0.1:18026")
    parser.add_argument("--extra-origin")
    args = parser.parse_args()
    context = ssl.create_default_context(cafile=args.ca_file)
    https = Client(args.https_url, context)
    plain = Client(args.http_url, context)
    https_secure = args.cookie_mode != "false"
    http_secure = args.cookie_mode == "true"

    for attempt in range(60):
        try:
            status, body, _ = https.request("/api/health")
            if status == 200 and body.get("status") == "UP":
                break
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(1)
    else:
        raise AssertionError("HTTPS health failed: check public forwarded scheme and host/port")

    logs = subprocess.check_output(["docker", "logs", args.container], stderr=subprocess.STDOUT).decode()
    assert "one-time bootstrap code" not in logs, "Obsolete setup code is still generated"
    credentials = {"username": "proxy-test-admin", "password": "Disposable-TGFlow-proxy-test-password"}
    status, _, headers = https.request("/api/auth/bootstrap", credentials)
    assert status == 201, f"HTTPS bootstrap rejected with status {status}"
    assert_cookies(headers, https_secure)
    assert https.request("/api/auth/bootstrap/status")[1] == {"required": False}
    assert https.request("/api/auth/bootstrap", credentials)[0] == 404
    assert https.request("/api/auth/session")[0] == 200
    https.assert_legacy_session(https_secure)
    assert https.request("/api/auth/logout", {})[0] == 403
    assert https.request("/api/auth/logout", {}, headers={"X-CSRF-Token": https.csrf()})[0] == 204
    assert https.request("/api/auth/session")[0] == 401
    status, body, headers = https.request("/api/auth/login", credentials)
    assert status == 200 and body.get("authenticated"), f"HTTPS login rejected with status {status}"
    assert_cookies(headers, https_secure)
    assert https.request("/api/auth/session")[0] == 200
    assert https.request("/api/auth/session", origin="https://other.example.test")[0] == 403
    assert https.websocket_status(context) == 101
    assert https.websocket_status(context, "https://other.example.test") == 403

    insecure_request = urllib.request.Request(plain.base + "/api/auth/session")
    https.jar.add_cookie_header(insecure_request)
    if https_secure:
        assert "tf_admin=" not in insecure_request.get_header("Cookie", ""), "Secure cookie leaked to HTTP"
    assert plain.request("/api/health")[0] == 200
    assert plain.request("/api/auth/bootstrap/status", headers={"X-Forwarded-Proto": "invalid"})[0] == 200
    status, body, headers = plain.request("/api/auth/login", credentials)
    assert status == 200 and body.get("authenticated"), f"HTTP login rejected with status {status}"
    assert_cookies(headers, http_secure)
    assert plain.request("/api/auth/session")[0] == (401 if http_secure else 200)
    if not http_secure:
        plain.assert_legacy_session(False)
        assert plain.websocket_status(context) == 101
    assert https.request("/api/auth/session")[0] == 200, "HTTP access affected the HTTPS session"
    if args.extra_origin:
        status, _, headers = https.request("/api/settings", origin=args.extra_origin,
            method="OPTIONS", headers={"Access-Control-Request-Method": "GET"})
        assert status == 204 and headers.get("Access-Control-Allow-Origin") == args.extra_origin
    print(f"Proxy mode {args.cookie_mode} passed: HTTP/HTTPS login, automatic origin/host/port, cookies, sessions, CSRF, WS/WSS")


if __name__ == "__main__":
    main()
