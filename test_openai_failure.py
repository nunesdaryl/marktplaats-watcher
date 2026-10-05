from types import SimpleNamespace

import pytest

from openai_failure import classify_openai_failure


@pytest.mark.parametrize("error,expected", [
    (SimpleNamespace(body={"error": {"code": "credit_balance_exhausted", "message": "You have no credits remaining"}}), "credit_exhausted"),
    (SimpleNamespace(code="insufficient_quota"), "credit_exhausted"),
    (SimpleNamespace(body={"error": {"message": "Project budget limit reached"}}), "spend_cap"),
    (SimpleNamespace(status_code=429, code="rate_limit_exceeded"), "rate_limited"),
    (SimpleNamespace(status_code=401, code="invalid_api_key"), "auth"),
    (RuntimeError("Error code: 401 - Unauthorized"), "auth"),
    (RuntimeError("connection reset"), "other"),
])
def test_classify_openai_failure(error, expected):
    assert classify_openai_failure(error) == expected
