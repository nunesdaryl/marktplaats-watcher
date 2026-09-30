"""Server-to-server requests from the chat API to Convex."""

import os

import httpx


def convex_post(path, payload):
    site = os.getenv("CONVEX_SITE_URL", "").rstrip("/")
    secret = os.getenv("API_TO_CONVEX_SECRET", "")
    if not site or not secret:
        raise ValueError("Convex usage check is not configured")
    response = httpx.post(f"{site}{path}", json=payload, headers={"X-Api-Secret": secret}, timeout=5)
    response.raise_for_status()
    return response.json()
