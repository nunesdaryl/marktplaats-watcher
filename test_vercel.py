"""Checks for Vercel response headers."""
import json
import re
from pathlib import Path


def test_no_store_excludes_hashed_assets_and_fonts():
    config = json.loads((Path(__file__).parent / "vercel.json").read_text())
    rules = [rule for rule in config["headers"] if rule["headers"] == [
        {"key": "Cache-Control", "value": "no-store"}
    ]]
    assert len(rules) == 1

    source = rules[0]["source"]
    for path in ("/", "/alerts/", "/manifest.json", "/favicon.ico"):
        assert re.fullmatch(source, path)
    for path in ("/_next/static/chunks/app.js", "/fonts/site.woff2"):
        assert not re.fullmatch(source, path)


def test_security_headers_rule_is_unchanged():
    config = json.loads((Path(__file__).parent / "vercel.json").read_text())
    assert config["headers"][0] == {
        "source": "/(.*)",
        "headers": [
            {"key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://admarkt-cdn.marktplaats.com https://images.marktplaats.com https://img.clerk.com https://*.convex.cloud; font-src 'self' data:; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://clerk-telemetry.com; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report"},
            {"key": "X-Frame-Options", "value": "DENY"},
            {"key": "X-Content-Type-Options", "value": "nosniff"},
            {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
            {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()"},
            {"key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains"},
        ],
    }


def test_cache_reset_header_is_limited_to_the_purge_file():
    config = json.loads((Path(__file__).parent / "vercel.json").read_text())
    reset_rules = [rule for rule in config["headers"] if any(
        header["key"] == "Clear-Site-Data" for header in rule["headers"]
    )]
    assert reset_rules == [{
        "source": "/cache-reset.txt",
        "headers": [
            {"key": "Clear-Site-Data", "value": '"cache"'},
            {"key": "Cache-Control", "value": "no-store"},
        ],
    }]
    for path in ("/", "/admin/", "/alerts/", "/other-cache-reset.txt"):
        assert not re.fullmatch(reset_rules[0]["source"], path)
