"""Keep pytest isolated from deployed services and local credentials."""

import os
from contextvars import ContextVar

os.environ["PYTHON_DOTENV_DISABLED"] = "1"

SECRET_NAMES = (
    "CONVEX_SITE_URL",
    "API_TO_CONVEX_SECRET",
    "CRON_SECRET",
    "HEALTH_KEY",
    "OPENAI_API_KEY",
    "AGENTMAIL_API_KEY",
    "MCP_OWNER_TOKEN",
)
for name in SECRET_NAMES:
    os.environ.pop(name, None)

import httpx  # noqa: E402
import pytest  # noqa: E402


_network_allowed = ContextVar("pytest_network_allowed", default=False)


def pytest_configure(config):
    config.addinivalue_line("markers", "network: allow outbound HTTP for this test")


@pytest.fixture(scope="session", autouse=True)
def _offline_http():
    for name in SECRET_NAMES:
        os.environ.pop(name, None)

    send = httpx.Client.send
    async_send = httpx.AsyncClient.send

    def check_host(request):
        host = request.url.host
        if not _network_allowed.get() and host not in ("testserver", "localhost"):
            raise RuntimeError(f"tests must not call {host}; mock it")

    def guarded_send(self, request, *args, **kwargs):
        check_host(request)
        return send(self, request, *args, **kwargs)

    async def guarded_async_send(self, request, *args, **kwargs):
        check_host(request)
        return await async_send(self, request, *args, **kwargs)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(httpx.Client, "send", guarded_send)
        patch.setattr(httpx.AsyncClient, "send", guarded_async_send)
        yield


@pytest.fixture(autouse=True)
def _test_environment(_offline_http, request):
    for name in SECRET_NAMES:
        os.environ.pop(name, None)
    token = _network_allowed.set(request.node.get_closest_marker("network") is not None)
    try:
        yield
    finally:
        _network_allowed.reset(token)
