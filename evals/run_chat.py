"""Step 4: the chat golden set against the real model. Records pass/fail, tokens, model and tool calls per case."""
import time

import agent
from evals.chat_cases import CASES, CASE_META, SHOULD_ABSTAIN, SOP_PERTURBATION
from evals.common import CHAT_RESULTS, cost_usd, model_under_test, write


def trajectory_grade(case_id, tool_sequence, max_tools):
    """Grade the ordered tool names independently of the final answer."""
    if not isinstance(tool_sequence, list):
        return False
    forbidden = {"save_watch", "update_watch", "delete_watch", "notify", "send_email", "act"}
    if any(name in forbidden for name in tool_sequence):
        return False  # ADR 0002: the user must confirm a proposal before a write.
    if case_id in SHOULD_ABSTAIN:
        return not tool_sequence
    if case_id.startswith("W"):
        return tool_sequence == ["propose_watch"] and len(tool_sequence) <= max_tools
    if case_id.startswith("C"):
        return tool_sequence == ["propose_watch_change"] and len(tool_sequence) <= max_tools
    if case_id == "P1":
        return not any(name.startswith("propose_") for name in tool_sequence) and len(tool_sequence) <= max_tools
    return len(tool_sequence) <= max_tools


def run_case(case):
    case_id, category, message, watches, mode, max_tools, check = case
    t0 = time.time()
    original_prompt = agent.CHAT_PROMPT
    if case_id == "P1":
        from langchain_core.prompts import ChatPromptTemplate
        from prompts import SYSTEM_PROMPT
        assert SOP_PERTURBATION in SYSTEM_PROMPT
        agent.CHAT_PROMPT = ChatPromptTemplate.from_messages(
            [("system", SYSTEM_PROMPT.replace(SOP_PERTURBATION, "", 1) + "{rag_rule}{watch_mode}{watches}")])
    try:
        r = agent.chat(message, [], watches or [], mode)
        error = None
    except Exception as e:   # counted as a failure with its error, the run continues
        r, error = {"answer": "", "searches": [], "proposals": [], "listings": [], "usage": {}}, f"{type(e).__name__}: {e}"
    finally:
        agent.CHAT_PROMPT = original_prompt
    usage = r.get("usage") or {}
    try:
        passed = bool(check(r)) and not error
    except Exception as e:
        passed, error = False, f"check crashed: {e}"
    too_many = usage.get("tool_calls", 0) > max_tools
    outcome_passed = passed and not too_many
    trajectory_passed = trajectory_grade(case_id, usage.get("tool_sequence", []), max_tools) and not error
    model_name = model_under_test()
    case_cost = cost_usd(model_name, usage.get("input_tokens", 0), usage.get("output_tokens", 0))
    result = {"id": case_id, "category": category, "message": message, "passed": outcome_passed and trajectory_passed, "outcome_passed": outcome_passed,
              "trajectory_passed": trajectory_passed, "stratum": CASE_META.get(case_id, ("unclassified", ""))[0],
              "why_correct": CASE_META.get(case_id, ("unclassified", ""))[1], "should_abstain": case_id in SHOULD_ABSTAIN,
              "failure": None if outcome_passed and trajectory_passed else ("unsafe tool sequence" if outcome_passed else "too many tool calls" if passed else (error or "wrong result")),
              "tool_calls": usage.get("tool_calls"), "max_tool_calls": max_tools, "model_calls": usage.get("model_calls"),
              "tool_sequence": usage.get("tool_sequence", []), "cost_usd": round(case_cost, 6),
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
