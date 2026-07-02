#!/usr/bin/env python3
"""
Bulk password-reset traffic generator for Parc Fermé.

Drives the real two-step reset flow so the origin emits the X-Auth-Event signals
the Fastly NGWAF templated rules key off:

    POST /api/auth/forgot-password  -> X-Auth-Event: password-reset-attempt
    POST /api/auth/reset-password   -> password-reset-success (valid token)
                                       password-reset-failure (bogus token)

The reset token is returned in the forgot-password JSON response ONLY for emails
on the server's RESET_TEST_DOMAIN, so no server logs are needed. Set that env var
on the server (e.g. RESET_TEST_DOMAIN=resettest.dev) and match --domain here.

Stdlib only — no pip install required.

Usage:
    python3 scripts/reset_flood.py --base https://parcferme.fastlylab.com --count 50
    python3 scripts/reset_flood.py --count 100 --fail-rate 0.25 --domain resettest.dev
"""
import argparse
import json
import random
import urllib.error
import urllib.request
import uuid


def post(base, path, body):
    """POST JSON; return (status, parsed_body). status 0 == network error."""
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:  # 4xx/5xx still carry a JSON body
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        return 0, {"error": str(e)}


def main():
    ap = argparse.ArgumentParser(description="Generate password-reset WAF signals.")
    ap.add_argument("--base", default="http://localhost:4000", help="API base URL")
    ap.add_argument("--domain", default="resettest.dev", help="must match server RESET_TEST_DOMAIN")
    ap.add_argument("--count", type=int, default=20, help="number of successful resets")
    ap.add_argument("--fail-rate", type=float, default=0.2, help="fraction that also fire a bogus-token failure")
    ap.add_argument("--password", default="FloodNew123", help="new password to set")
    args = ap.parse_args()

    counts = {"attempt": 0, "success": 0, "failure": 0}
    for _ in range(args.count):
        email = f"flood-{uuid.uuid4().hex[:10]}@{args.domain}"

        # 1. throwaway account (a 409 if it already exists is harmless)
        post(args.base, "/api/auth/register",
             {"name": "Reset Flood", "email": email, "password": "FloodPass1"})

        # 2. request a reset -> attempt; token comes back for the test domain
        _, body = post(args.base, "/api/auth/forgot-password", {"email": email})
        counts["attempt"] += 1
        token = body.get("resetToken")
        if not token:
            print(f"! no token for {email} — is RESET_TEST_DOMAIN={args.domain} set on the server?")
            continue

        # 3. complete the reset -> success
        status, _ = post(args.base, "/api/auth/reset-password",
                         {"token": token, "password": args.password})
        if status == 200:
            counts["success"] += 1

        # optional: a bogus token -> failure signal
        if args.fail_rate > 0 and random.random() < args.fail_rate:
            post(args.base, "/api/auth/reset-password",
                 {"token": "bogus-" + uuid.uuid4().hex, "password": args.password})
            counts["failure"] += 1

    print(json.dumps({"base": args.base, "domain": args.domain, **counts}, indent=2))


if __name__ == "__main__":
    main()
