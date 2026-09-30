"""Repeat one chat golden case through the same check as the full chat eval."""
import sys
import time

from evals.chat_cases import CASES
from evals.common import REPEAT_RESULTS, model_under_test, read, write
from evals.run_chat import agent, run_case


def main(case_id=None, runs=None):
    if case_id is None or runs is None:
        if len(sys.argv) != 3:
            raise SystemExit("usage: python -m evals.repeat CASE_ID RUNS")
        case_id, runs = sys.argv[1:]
    try:
        runs = int(runs)
    except ValueError:
        raise SystemExit("RUNS must be a positive integer") from None
    if runs < 1:
        raise SystemExit("RUNS must be a positive integer")
    case = next((case for case in CASES if case[0] == case_id), None)
    if case is None:
        raise SystemExit(f"unknown chat case: {case_id}")

    model = model_under_test()
    passed = sum(run_case(case)[0]["passed"] for _ in range(runs))
    results = read(REPEAT_RESULTS) if REPEAT_RESULTS.exists() else []
    results = [entry for entry in results if entry["case"] != case_id]
    results.append({"case": case_id, "runs": runs, "passed": passed,
                    "prompt_version": agent.PROMPT_VERSION["chat"], "model": model,
                    "at": time.strftime("%Y-%m-%d %H:%M")})
    write(REPEAT_RESULTS, results)
    print(f"{case_id}: {passed}/{runs}")


if __name__ == "__main__":
    main()
