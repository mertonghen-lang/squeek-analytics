#!/usr/bin/env python3
"""Fetch the public Squeek API with a browser TLS fingerprint.

The dev server uses this only after Node's fetch receives a Cloudflare challenge.
It refuses any host other than api.squeekchain.com.
"""

from __future__ import annotations

import base64
import json
import sys
from urllib.parse import urlparse

from curl_cffi import requests

ALLOWED_HOST = "api.squeekchain.com"
HEADER_NAMES = (
    "etag",
    "retry-after",
    "x-request-id",
    "x-squeek-settlement-source",
    "cache-control",
    "content-type",
)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: upstream.py URL [if-none-match]")
    url = sys.argv[1]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise SystemExit(f"refusing host {parsed.hostname}")
    if not parsed.path.startswith("/v1/") and parsed.path not in ("/healthz", "/readyz"):
        raise SystemExit(f"refusing path {parsed.path}")
    headers = {"Accept": "application/json"}
    if len(sys.argv) > 2 and sys.argv[2]:
        headers["If-None-Match"] = sys.argv[2]
    response = requests.get(url, headers=headers, impersonate="chrome", timeout=40)
    kept = {name: response.headers[name] for name in HEADER_NAMES if name in response.headers}
    json.dump(
        {
            "status": response.status_code,
            "headers": kept,
            "body": base64.b64encode(response.content).decode("ascii"),
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
