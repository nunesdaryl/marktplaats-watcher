import datetime
import importlib.util
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("feedback_drafts", Path(__file__).with_name("feedback_drafts.py"))
feedback_drafts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feedback_drafts)

NOW = datetime.datetime(2026, 10, 2, tzinfo=datetime.timezone.utc)


def fixture():
    feedback = [
        {"id": "fd1", "status": "new", "message": "Search misses red bikes", "createdAt": 1790899200000, "issues": []},
        {"id": "fd2", "status": "new", "message": "Search misses red bikes", "createdAt": 1790899200000, "issues": []},
        {"id": "fd3", "status": "planned", "message": "Old item", "createdAt": 1790899200000},
    ]
    ratings = [
        {"id": "r1", "watchId": "w1", "watchDescription": "Bikes", "at": "2026-10-01T00:00:00Z", "verdict": "not_right", "reasons": ["price"]},
        {"id": "r2", "watchId": "w1", "watchDescription": "Bikes", "at": "2026-10-01T00:00:00Z", "verdict": "not_right", "reasons": ["price"]},
        {"id": "r3", "watchId": "w2", "watchDescription": "Bikes", "at": "2026-08-01T00:00:00Z", "verdict": "not_right", "reasons": ["price"]},
    ]
    audits = [{"id": "a1", "watchId": "w1", "at": 1790899200000, "misses": [
        {"listingId": "l1", "kind": "never_read"}, {"listingId": "l2", "kind": "never_read"}]}]
    return feedback, ratings, audits


def test_groups_sources_and_cites_evidence():
    result = feedback_drafts.drafts(*fixture(), now=NOW)
    assert len(result) == 3
    feedback = next(row for row in result if row["key"].startswith("feedback-"))
    assert feedback["feedback_ids"] == ["fd1", "fd2"]
    assert "2 new tracker item" in feedback["problem"]
    assert "feedback:fd1 (2026-10-02; source app)" in feedback["problem"]
    assert "rating:r1" in next(row for row in result if row["key"].startswith("rating-"))["problem"]
    assert "listing:l2" in next(row for row in result if row["key"].startswith("audit-"))["problem"]


def test_duplicate_guard_checks_title_and_evidence_id():
    draft = feedback_drafts.drafts(*fixture(), now=NOW)[1]
    assert feedback_drafts.duplicate(draft, [{"identifier": "MW-1", "title": draft["title"], "description": ""}]) == "MW-1"
    assert feedback_drafts.duplicate(draft, [{"identifier": "MW-2", "title": "Different title", "description": "Seen feedback:fd1 before"}]) == "MW-2"


def test_file_labels_and_plans_only_linked_feedback():
    draft = next(row for row in feedback_drafts.drafts(*fixture(), now=NOW) if row["key"].startswith("feedback-"))
    with patch.object(feedback_drafts.lin, "gql", return_value={"issueCreate": {"success": True, "issue": {"id": "linear-1", "identifier": "MW-60"}}}) as gql, \
         patch.object(feedback_drafts.lin, "comment") as comment, \
         patch.object(feedback_drafts, "convex") as convex:
        identifier = feedback_drafts.file_draft(draft, "team-mw", {"draft": "label-draft", feedback_drafts.ENGINE: "label-engine"})
    assert identifier == "MW-60"
    assert gql.call_args.args[1]["input"]["labelIds"] == ["label-draft", "label-engine"]
    assert "agent-ready" not in gql.call_args.args[1]["input"]
    assert convex.call_count == 2
    assert {call.args[1]["id"] for call in convex.call_args_list} == {"fd1", "fd2"}
    assert all(call.args[1]["issue"] == "MW-60" for call in convex.call_args_list)
    comment.assert_called_once()


def test_read_only_main_does_not_create_or_plan(capsys):
    feedback, ratings, audits = fixture()
    with patch.object(feedback_drafts, "convex", side_effect=[feedback, ratings, audits]) as convex, \
         patch.object(feedback_drafts, "linear_context", return_value=("team", {"draft": "d", feedback_drafts.ENGINE: "e"}, [])), \
         patch.object(feedback_drafts, "file_draft") as create:
        feedback_drafts.main([])
    assert convex.call_count == 3
    create.assert_not_called()
    assert "## Problem" in capsys.readouterr().out


def test_file_main_selects_only_named_draft():
    feedback, ratings, audits = fixture()
    with patch.object(feedback_drafts, "convex", side_effect=[feedback, ratings, audits]), \
         patch.object(feedback_drafts, "linear_context", return_value=("team", {"draft": "d", feedback_drafts.ENGINE: "e"}, [])), \
         patch.object(feedback_drafts, "file_draft", return_value="MW-60") as create:
        feedback_drafts.main(["--file", "feedback-fd1"])
    create.assert_called_once()
    assert create.call_args.args[0]["feedback_ids"] == ["fd1", "fd2"]
