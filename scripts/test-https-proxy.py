#!/usr/bin/env python3
"""Exercise the built image behind actual TLS, with a disposable CI administrator."""
import argparse
import base64
import http.client
import http.cookiejar
import http.cookies
import json
import os
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--ca-file", required=True)
    parser.add_argument("--https-url", default="https://127.0.0.1:7443")
    parser.add_argument("--http-url", default="http://127.0.0.1:6544")
    args = parser.parse_args()
    origin = args.https_url.rstrip("/")
    context = ssl.create_default_context(cafile=args.ca_file)
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=context),
    )

    def request(path, data=None, request_origin=origin, headers=None, base=origin):
        request_headers = {"Origin": request_origin, **(headers or {})}
        if data is not None:
            request_headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            base + path,
            data=None if data is None else json.dumps(data).encode(),
            headers=request_headers,
        )
        try:
            response = opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = {}
            return response.status, body, response.headers

    for attempt in range(60):
        try:
            status, body, _ = request("/api/health")
            if status == 200 and body.get("status") == "UP":
                break
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(1)
    else:
        raise AssertionError("HTTPS health failed: check forwarded scheme and host/port")

    logs = subprocess.check_output(["docker", "logs", args.container], stderr=subprocess.STDOUT).decode()
    match = re.search(r"one-time bootstrap code \(expires in 15 minutes\): (\S+)", logs)
    assert match, "Disposable container did not produce its bootstrap code"
    credentials = {"username": "proxy-test-admin", "password": "Disposable-TGFlow-proxy-test-password"}
    status, _, headers = request("/api/auth/bootstrap", {**credentials, "bootstrapToken": match[1]})
    assert status == 200, f"HTTPS bootstrap rejected with status {status}"

    def assert_secure_cookies(headers):
        cookies = http.cookies.SimpleCookie()
        for header in headers.get_all("Set-Cookie", []):
            cookies.load(header)
        for name in ["tf_admin", "tf_csrf"]:
            assert name in cookies, f"Missing {name} cookie"
            assert cookies[name]["secure"], f"Missing Secure flag on {name}"
            assert cookies[name]["samesite"].lower() == "strict"
        assert cookies["tf_admin"]["httponly"]
        assert not cookies["tf_csrf"]["httponly"]

    assert_secure_cookies(headers)
    assert request("/api/auth/session")[0] == 200, "HTTPS session cookie was not accepted"
    csrf = next(cookie.value for cookie in jar if cookie.name == "tf_csrf")
    assert request("/api/auth/logout", {})[0] == 403, "CSRF protection was bypassed"
    assert request("/api/auth/logout", {}, headers={"X-CSRF-Token": csrf})[0] == 200
    assert request("/api/auth/session")[0] == 401, "Logout did not revoke the session"
    status, body, headers = request("/api/auth/login", credentials)
    assert status == 200 and body.get("authenticated"), f"HTTPS login rejected with status {status}"
    assert_secure_cookies(headers)
    assert request("/api/auth/session")[0] == 200
    assert request("/api/auth/session", request_origin="https://other.example.test")[0] == 403

    http_request = urllib.request.Request(args.http_url + "/api/auth/session")
    jar.add_cookie_header(http_request)
    assert "tf_admin=" not in http_request.get_header("Cookie", ""), "Secure admin cookie leaked to HTTP"
    assert request("/api/auth/session", request_origin=args.http_url, base=args.http_url)[0] == 401
    assert request("/api/auth/bootstrap/status", request_origin=args.http_url, base=args.http_url,
                   headers={"X-Forwarded-Proto": "invalid-protocol"})[0] == 200

    def websocket_status(ws_origin):
        cookie_request = urllib.request.Request(origin + "/ws")
        jar.add_cookie_header(cookie_request)
        target = urllib.parse.urlsplit(origin)
        connection = http.client.HTTPSConnection(target.hostname, target.port, context=context, timeout=15)
        try:
            connection.request("GET", "/ws", headers={
                "Host": target.netloc,
                "Origin": ws_origin,
                "Cookie": cookie_request.get_header("Cookie", ""),
                "Connection": "Upgrade",
                "Upgrade": "websocket",
                "Sec-WebSocket-Version": "13",
                "Sec-WebSocket-Key": base64.b64encode(os.urandom(16)).decode(),
            })
            return connection.getresponse().status
        finally:
            connection.close()

    assert websocket_status(origin) == 101, "Authenticated WSS handshake failed"
    assert websocket_status("https://other.example.test") == 403, "WSS accepted a foreign origin"
    print("HTTPS proxy passed: bootstrap, Secure cookies, login/session/logout, CSRF, host/port, WSS and origin rejection")


if __name__ == "__main__":
    main()
