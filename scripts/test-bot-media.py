#!/usr/bin/env python3
"""Run inside the built image; exercise real yt-dlp/FFmpeg against a loopback video fixture."""
import functools
import http.server
import json
from pathlib import Path
import subprocess
import tempfile
import threading


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


with tempfile.TemporaryDirectory(prefix="tgflow-media-check-") as directory:
    root = Path(directory)
    source = root / "source"
    source.mkdir()
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=32x32:r=10",
        "-t", "0.5", "-c:v", "mpeg4", str(source / "fixture.mp4"),
    ], check=True, timeout=20)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(source)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        result = subprocess.run([
            "/opt/yt-dlp/bin/yt-dlp", "--ignore-config", "--no-plugin-dirs", "--no-playlist",
            "--playlist-items", "1", "--match-filters", "!is_live", "--no-progress", "--no-colors",
            "--socket-timeout", "10", "--retries", "1", "--fragment-retries", "1",
            "--js-runtimes", "node", "--no-remote-components", "--proxy", "", "--max-filesize", "10M",
            "--windows-filenames", "--trim-filenames", "180", "--paths", str(root / "downloads"),
            "--output", "%(title).150B [%(id)s].%(ext)s", "--print", "after_move:TGFlowFile:%(filepath)j",
            "--", f"http://127.0.0.1:{server.server_port}/fixture.mp4",
        ], check=True, capture_output=True, text=True, timeout=30)
        paths = [json.loads(line.removeprefix("TGFlowFile:")) for line in result.stdout.splitlines()
                 if line.startswith("TGFlowFile:")]
        assert len(paths) == 1, "Expected one completed file marker"
        downloaded = Path(paths[0]).resolve(strict=True)
        assert downloaded.is_relative_to((root / "downloads").resolve())
        assert downloaded.read_bytes() == (source / "fixture.mp4").read_bytes()
        subprocess.run(["ffprobe", "-v", "error", str(downloaded)], check=True, timeout=10)
        print("Bundled yt-dlp downloaded a real video and emitted a valid completion marker.")
    finally:
        server.shutdown()
        server.server_close()
