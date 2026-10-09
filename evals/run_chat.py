"""Step 4: the chat golden set against the real model. Records pass/fail, tokens, model and tool calls per case."""
import time

import agent
from evals.chat_cases import CASES
from evals.common import CHAT_RESULTS, cost_usd, model_under_test, write


def run_case(case):
    case_id, category, message, watches, mode, max_tools, check = case
    t0 = time.time()
    try:
        r = agent.chat(message, [], watches or [], mode)
        error = None
    except Exception as e:   # counted as a failure with its error, the run continues
        r, error = {"answer": "", "searches": [], "proposals": [], "listings": [], "usage": {}}, f"{type(e).__name__}: {e}"
    usage = r.get("usage") or {}
    try:
        passed = bool(check(r)) and not error
    except Exception as e:
        passed, error = False, f"check crashed: {e}"
    too_many = usage.get("tool_calls", 0) > max_tools
    result = {"id": case_id, "category": category, "message": message, "passed": passed and not too_many,
              "failure": None if passed and not too_many else ("too many tool calls" if passed else (error or "wrong result")),
              "tool_calls": usage.get("tool_calls"), "max_tool_calls": max_tools, "model_calls": usage.get("model_calls"),
              "tool_sequence": usage.get("tool_sequence", []),
              "answer": r["answer"][:300], "searches": r["searches"], "proposals": r["proposals"],
              "ms": round((time.time() - t0) * 1000)}
    return result, usage


def main():
    model = model_under_test()
    results, tokens_in, tokens_out = [], 0, 0
    for case_id, category, message, watches, mode, max_tools, check in CASES:
        result, usage = run_case((case_id, category, message, watches, mode, max_tools, check))
        results.append(result)
        tokens_in += usage.get("input_tokens", 0)
        tokens_out += usage.get("output_tokens", 0)
        print(f"{case_id:3} {'PASS' if results[-1]['passed'] else 'FAIL'}  tools {usage.get('tool_calls')}/{max_tools}  {message[:60]}")
    usd = cost_usd(model, tokens_in, tokens_out)
    passed = sum(r["passed"] for r in results)
    write(CHAT_RESULTS, {"run_at": time.strftime("%Y-%m-%d %H:%M"), "model": model, "prompt_version": agent.PROMPT_VERSION["chat"], "passed": passed,
                         "total": len(results), "tokens": {"input": tokens_in, "output": tokens_out},
                         "cost_usd": round(usd, 5), "cost_usd_per_question": round(usd / len(results), 5), "cases": results})
    print(f"{passed}/{len(results)} passed, cost ${usd:.4f}")


if __name__ == "__main__":
    main()
