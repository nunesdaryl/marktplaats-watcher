"""Classify provider failures without exposing provider details to app users."""


def classify_openai_failure(error):
    parts = []
    seen = set()
    statuses = []
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        parts.append(str(error).lower())
        for attr in ("code", "type", "status_code", "body"):
            value = getattr(error, attr, None)
            if value is not None:
                parts.append(str(value).lower())
                if attr == "status_code":
                    statuses.append(value)
        error = getattr(error, "__cause__", None) or getattr(error, "__context__", None)
    detail = " ".join(parts)
    if any(value in detail for value in ("spend_cap", "billing_hard_limit_reached", "budget exceeded", "budget limit", "project limit", "monthly limit", "hard limit")):
        return "spend_cap"
    if any(value in detail for value in ("credit_balance_exhausted", "insufficient_quota", "no credits remaining", "out of credit")):
        return "credit_exhausted"
    if any(value in detail for value in ("invalid_api_key", "incorrect api key", "authenticationerror", "error code: 401", "401 unauthorized", "'status_code': 401", '"status_code": 401')) or 401 in statuses:
        return "auth"
    if any(value in detail for value in ("rate_limit", "rate limit", "too many requests", "429")):
        return "rate_limited"
    return "other"
