import importlib.util
import io
import json
import urllib.error
from pathlib import Path
from unittest.mock import patch
import pytest

spec = importlib.util.spec_from_file_location("factory_lin", Path(__file__).with_name("lin.py"))
lin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lin)


def test_gql_retries_503():
    response = io.BytesIO(json.dumps({"data": {"ok": True}}).encode())
    with patch("urllib.request.urlopen", side_effect=[urllib.error.HTTPError("url", 503, "unavailable", {}, None), response]) as open_url, patch("time.sleep") as sleep, patch.object(lin, "key", return_value="test-key"):
        assert lin.gql("{ ok }") == {"ok": True}
    assert open_url.call_count == 2
    sleep.assert_called_once()


SHA = "a" * 40


def merge_issue(verdict_claim=True, approval_time="2026-10-02T10:03:00Z"):
    claim = {"id": "claim-1", "createdAt": "2026-10-02T10:01:00Z", "body": "factory-review claim 2026-10-02T10:01:00Z station=chatgpt"}
    claim_field = " claim=claim-1" if verdict_claim else ""
    verdict = {"id": "verdict-1", "createdAt": "2026-10-02T10:02:00Z", "body": f"factory-review verdict 2026-10-02T10:02:00Z station=chatgpt{claim_field} result=PASS sha={SHA}"}
    comments = [claim, verdict]
    if approval_time:
        comments.append({"id": "approval-1", "createdAt": approval_time, "body": "Operator merge approval: Daryl, in chat, 2 Oct 2026"})
    return {"id": "issue-1", "state": {"type": "started"}, "team": {"states": {"nodes": [{"id": "done-1", "name": "Done"}]}}, "labels": [{"id": "label-1", "name": "ready-to-merge"}], "comments": comments}


def test_ready_accepts_explicit_claim_and_later_approval():
    with patch.object(lin, "issue", return_value=merge_issue()):
        assert lin.ready("MW-47", SHA)["merge"] == {"claim": "claim-1", "station": "chatgpt", "approver": "Daryl, in chat, 2 Oct 2026"}


def test_ready_accepts_latest_prior_claim_fallback():
    with patch.object(lin, "issue", return_value=merge_issue(verdict_claim=False)):
        assert lin.ready("MW-47", SHA)["merge"]["claim"] == "claim-1"


@pytest.mark.parametrize("approval_time", [None, "2026-10-02T10:00:00Z"])
def test_ready_refuses_missing_or_earlier_approval(approval_time):
    with patch.object(lin, "issue", return_value=merge_issue(approval_time=approval_time)):
        with pytest.raises(RuntimeError, match="Operator merge approval after the PASS verdict"):
            lin.ready("MW-47", SHA)
