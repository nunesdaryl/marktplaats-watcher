"""Golden owner-dashboard intent cases. Run with python -m evals.admin_intents when a model key is available."""
from agent import admin_intent


CONTEXT = {"today": "2026-09-30", "users": ["vin@example.com", "anna@example.com"],
           "watches": ["Road bike", "Mac mini"]}

CASES = [
    ("alerts for Vin this week above 8", {"view": "alerts", "userEmail": "vin@example.com",
                                           "since": "2026-09-28", "until": "2026-10-05", "minScore": 8}),
    ("errors today", {"view": "errors", "since": "2026-09-30", "until": "2026-10-01"}),
    ("which watches missed matches", {"view": "audits"}),
    ("chats by Vin", {"view": "chats", "userEmail": "vin@example.com"}),
    ("watches that can't keep up", {"view": "watches", "status": "behind"}),
    ("catch-up e-mails", {"view": "catchups"}),
    ("failed runs today", {"view": "runs", "status": "failed", "since": "2026-09-30", "until": "2026-10-01"}),
    ("chat errors", {"view": "errors", "kind": "chat"}),
    ("alerts from Road bike", {"view": "alerts", "watchLabel": "Road bike"}),
    ("failed alert e-mails", {"view": "alerts", "status": "failed"}),
    ("paused watches", {"view": "watches", "status": "paused"}),
    ("matches that were never read", {"view": "audits", "kind": "never_read"}),
    ("feedback from Anna", {"view": "feedback", "userEmail": "anna@example.com"}),
    ("ratings above 8", {"view": "ratings", "minScore": 8}),
    ("activity by Vin", {"view": "events", "userEmail": "vin@example.com"}),
]


def main():
    passed = 0
    for question, expected in CASES:
        actual = admin_intent(question, CONTEXT)
        params = {key: value for key, value in actual.items() if key != "title" and value is not None}
        ok = params == expected
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'} {question}" + ("" if ok else f" expected={expected} actual={params}"))
    print(f"{passed}/{len(CASES)}")
    if passed != len(CASES):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
