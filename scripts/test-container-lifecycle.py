#!/usr/bin/env python3
"""Test foreign health responses, API bind failure and either service exiting."""
import argparse
import http.server
import json
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request


CONTAINER = "tgflow-lifecycle"


def docker(*args, check=True):
    return subprocess.run(["docker", *args], check=check, capture_output=True, text=True)


def state():
    return json.loads(docker("inspect", CONTAINER, "--format", "{{json .State}}").stdout)


def remove_container():
    if sys.exc_info()[0] is not None:
        logs = docker("logs", CONTAINER, check=False)
        print("\n".join(line for line in (logs.stdout + logs.stderr).splitlines()
                        if "one-time bootstrap code" not in line))
    docker("rm", "-f", CONTAINER, check=False)


def wait_for(predicate, description, timeout=60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.5)
    raise AssertionError(f"Timed out waiting for {description}")


def request(path):
    try:
        response = urllib.request.urlopen("http://127.0.0.1:8027" + path, timeout=3)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers.get("X-TGFlow-Service"), response.read()


def healthy():
    current = state()
    assert current["Running"], f"Container exited before startup: {current}"
    return current.get("Health", {}).get("Status") == "healthy"


def port_is_free():
    with socket.socket() as listener:
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("0.0.0.0", 8027))


def assert_failed():
    wait_for(lambda: state()["Status"] == "exited", "required-service failure to exit the container")
    assert state()["ExitCode"] != 0, "Unexpected service exit was reported as success"
    port_is_free()


class ForeignHealth(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'{"code":"200","msg":"ok","data":{"status":"up"}}'
        degraded = getattr(self.server, "degraded", False)
        self.send_response(503 if degraded else (200 if self.path == "/health" else 404))
        if degraded:
            self.send_header("X-TGFlow-Service", "tgflow-api")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


def verify_foreign_service(image):
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 18028), ForeignHealth)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        # Keep only Nginx alive so the health probe has time to classify the
        # foreign service's HTTP 200. A normal startup must exit instead.
        docker("run", "-d", "--name", CONTAINER, "--network", "host",
               "--health-interval=1s", "--health-start-period=1s", "--health-retries=1",
               "--entrypoint", "sh", image, "-ec",
               "envsubst '$NGINX_PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf; "
               "exec nginx -g 'daemon off;'")
        try:
            wait_for(lambda: state().get("Health", {}).get("Status") == "unhealthy",
                     "foreign service to be marked unhealthy")
            status, identity, _ = request("/api/health")
            assert status == 200 and identity is None, (status, identity)
            assert state()["Health"]["Log"][-1]["ExitCode"] != 0
            # Identity alone must not hide an HTTP failure from curl.
            server.degraded = True
            wait_for(lambda: state()["Health"]["Log"][-1]["ExitCode"] == 22,
                     "HTTP 503 with valid identity to fail the health probe")
            status, identity, _ = request("/api/health")
            assert status == 503 and identity == "tgflow-api", (status, identity)
        finally:
            remove_container()

        with tempfile.TemporaryDirectory(prefix="tgflow-bind-test-") as root:
            docker("run", "-d", "--name", CONTAINER, "--network", "host",
                   "-v", f"{root}:/data", image)
            try:
                assert_failed()
                logs = docker("logs", CONTAINER)
                assert "Failed to start API server on 0.0.0.0:18028: Address in use" in logs.stdout + logs.stderr
            finally:
                remove_container()
        print("Foreign HTTP 200 is unhealthy; API port collision exits nonzero and releases Nginx")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def verify_service_exit(image, service):
    with tempfile.TemporaryDirectory(prefix="tgflow-service-test-") as root:
        docker("run", "-d", "--name", CONTAINER, "--network", "host",
               "--health-interval=1s", "--health-start-period=1s",
               "-v", f"{root}:/data", image)
        try:
            wait_for(healthy, "TGFlow startup")
            status, identity, _ = request("/api/health")
            assert status == 200 and identity == "tgflow-api", (status, identity)
            assert request("/api/auth/bootstrap/status")[0] == 200
            if service == "stop":
                docker("stop", "--time", "40", CONTAINER)
                assert state()["Status"] == "exited" and state()["ExitCode"] == 0
                port_is_free()
            else:
                target = '$(pidof java)' if service == "java" else '"$(cat /run/nginx.pid)"'
                docker("exec", CONTAINER, "sh", "-ec", f"kill -KILL {target}")
                assert_failed()
            print(f"Required service lifecycle verified: {service}")
        finally:
            remove_container()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    image = parser.parse_args().image
    verify_foreign_service(image)
    for service in ["java", "nginx", "stop"]:
        verify_service_exit(image, service)


if __name__ == "__main__":
    main()
