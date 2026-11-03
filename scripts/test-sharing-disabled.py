#!/usr/bin/env python3
"""Verify the dev image cannot start platform sharing or qBittorrent, even with enabled legacy settings."""
import argparse
import base64
import http.server
import json
import os
import re
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import http.cookiejar
from pathlib import Path


class Tripwire(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.hits.append((self.command, self.path))
        self.send_response(503)
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = do_GET

    def log_message(self, *_):
        pass


class Client:
    def __init__(self, base):
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, path, data=None, method=None, csrf=True):
        headers = {"Origin": self.base}
        if data is not None:
            headers["Content-Type"] = "application/json"
            csrf_value = next((cookie.value for cookie in self.jar if cookie.name == "tf_csrf"), None)
            if csrf and csrf_value:
                headers["X-CSRF-Token"] = csrf_value
        request = urllib.request.Request(self.base + path, method=method, headers=headers,
            data=None if data is None else json.dumps(data).encode())
        try:
            response = self.opener.open(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = {}
            return response.status, body


def wait_for_health(client):
    for _ in range(60):
        try:
            if client.request("/api/health")[0] == 200:
                return
        except OSError:
            pass
        time.sleep(1)
    raise AssertionError("Image failed to start with legacy sharing environment")


def verify_case(image, server, malformed):
    container = "tgflow-share-blocked"
    base = "http://127.0.0.1:18027"
    endpoint = f"http://127.0.0.1:{server.server_port}"
    with tempfile.TemporaryDirectory(prefix="tgflow-sharing-test-") as root:
        state = Path(root) / "state"
        state.mkdir()
        (state / "path-compatibility-probe").write_text("tgflow-path-fixture")
        environment = {
            "APP_ENV": "dev",
            "NGINX_PORT": "18027",
            "PUID": str(os.getuid()), "PGID": str(os.getgid()),
            "SHARE_ENABLED": "true", "SEED_PLATFORM_URL": endpoint,
            "QBITTORRENT_URL": endpoint, "QBITTORRENT_USERNAME": "test-only",
            "QBITTORRENT_PASSWORD": "test-only", "SECRET_STORE_MASTER_KEY": base64.b64encode(bytes(32)).decode(),
            "SHARE_HEARTBEAT_INTERVAL_SECONDS": "1", "SHARED_ROOT": "/downloads/shared",
        }
        if malformed:
            environment.update(SEED_PLATFORM_URL="invalid legacy URL", QBITTORRENT_URL="invalid legacy URL",
                SHARE_CONCURRENCY="invalid", SHARED_ROOT="/data/account/overlap",
                PEER_LISTEN_PORT="0", SHARE_STATISTICS_ROLLOUT_PERCENT="101")
        command = ["docker", "run", "-d", "--name", container, "--network", "host",
            "-v", f"{state}:/data", "-v", f"{root}/downloads:/downloads"]
        for name, value in environment.items():
            command.extend(["-e", f"{name}={value}"])
        try:
            subprocess.run([*command, image], check=True, capture_output=True)
            client = Client(base)
            wait_for_health(client)
            logs = subprocess.check_output(["docker", "logs", container], stderr=subprocess.STDOUT).decode()
            match = re.search(r"one-time bootstrap code \(expires in 15 minutes\): (\S+)", logs)
            assert match, "Missing disposable bootstrap code"
            assert client.request("/api/telegram/application")[0] == 401
            credentials = {"username": "sharing-test-admin", "password": "Disposable-sharing-test-password"}
            assert client.request("/api/auth/bootstrap", {**credentials, "bootstrapToken": match[1]})[0] == 201
            assert client.request("/api/auth/session")[0] == 200
            subprocess.run(["docker", "exec", container, "sh", "-ec",
                'test "$APP_ROOT" = /data; test "$(cat /app/data/path-compatibility-probe)" = tgflow-path-fixture; '
                'test "$(stat -c %u /data/data.db)" = "$PUID"'], check=True, capture_output=True)
            assert client.request("/")[0] == 200
            assert client.request("/share")[0] == 404, "Removed frontend page was exported"

            status, application = client.request("/api/telegram/application")
            assert status == 200 and application["configured"] is False and "apiHash" not in application
            assert client.request("/api/telegram/create", {})[0] == 400
            application_input = {"apiId": 123456, "apiHash": "disposable-application-test-hash", "logLevel": 0}
            assert client.request("/api/telegram/application", application_input, csrf=False)[0] == 403
            status, saved = client.request("/api/telegram/application", application_input)
            assert status == 200 and saved["configured"] is True and saved["source"] == "saved"
            assert "apiHash" not in saved and application_input["apiHash"] not in json.dumps(saved)
            assert client.request("/api/telegram/application", {"apiId": 123457})[0] == 400
            assert client.request("/api/telegram/application", {"apiId": 123456, "apiHash": "", "logLevel": 2})[0] == 200

            # The application's SQLite connection uses an exclusive lock.
            # Prepare legacy data offline, then verify it across a real restart.
            subprocess.run(["docker", "stop", container], check=True, capture_output=True)
            with sqlite3.connect(state / "data.db") as db:
                db.execute("INSERT OR REPLACE INTO setting_record (key, value) VALUES (?, ?)", ("shareEnabled", "true"))
            subprocess.run(["docker", "start", container], check=True, capture_output=True)
            wait_for_health(client)
            assert client.request("/api/auth/login", credentials)[0] == 200
            status, restored = client.request("/api/telegram/application")
            assert status == 200 and restored["configured"] is True and restored["apiId"] == 123456
            assert restored["logLevel"] == 2 and restored["source"] == "saved" and "apiHash" not in restored
            subprocess.run(["docker", "exec", container, "sh", "-ec",
                'test -f /data/telegram-application.json; test -f /app/data/telegram-application.json; '
                'test "$(stat -c %u /data/telegram-application.json)" = "$PUID"'], check=True, capture_output=True)
            assert client.request("/api/settings?keys=shareEnabled")[1]["shareEnabled"] is False
            assert client.request("/api/settings/create", {"shareEnabled": True})[0] == 200
            assert client.request("/api/settings?keys=shareEnabled")[1]["shareEnabled"] is False

            commands = [
                ("GET", "/share/device/status", None), ("GET", "/share/resources", None),
                ("GET", "/share/publication-policy", None),
                ("POST", "/share/device/authorize", {"nodeName": "disabled"}),
                ("POST", "/share/device/cancel", {}), ("DELETE", "/share/node", {}),
                ("PUT", "/share/node/name", {"nodeName": "disabled"}),
                ("POST", "/share/resources", {"fileUniqueId": "disabled"}),
                ("PUT", "/share/resources/disabled", {}), ("DELETE", "/share/resources/disabled", {}),
            ]
            for method, path, body in commands:
                status, result = client.request("/api" + path, body, method)
                assert status == 404 and result.get("error", {}).get("code") == "SHARE_DISABLED", (method, path, status, result)
            for control in ["start-download", "cancel-download", "toggle-pause-download", "set-upload-limit"]:
                status, _ = client.request(f"/api/files/{control}-multiple", {
                    "files": [{"telegramId": 0, "uniqueId": "seed:disabled"}], "isPaused": False,
                    "uploadLimitBytesPerSecond": 0,
                })
                assert status == 400, (control, status)
            assert client.request("/api/files?downloadStatus=completed")[0] == 200
            time.sleep(2)
            assert server.hits == [], f"Unexpected platform/qBittorrent requests: {server.hits}"
            print(f"Sharing disabled ({'malformed' if malformed else 'enabled'} legacy settings): APIs blocked, no platform/qBittorrent requests; zero-env Telegram configuration saved and restored on /data, legacy path and non-root ownership verified")
        except Exception:
            logs = subprocess.run(["docker", "logs", container], capture_output=True, text=True)
            print("\n".join(line for line in (logs.stdout + logs.stderr).splitlines()
                if "one-time bootstrap code" not in line))
            raise
        finally:
            subprocess.run(["docker", "rm", "-f", container], capture_output=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Tripwire)
    server.hits = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for malformed in [False, True]:
            verify_case(args.image, server, malformed)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
