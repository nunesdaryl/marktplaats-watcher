import importlib.util
import io
import json
import urllib.error
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("factory_lin", Path(__file__).with_name("lin.py"))
lin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lin)


def test_gql_retries_503():
    response = io.BytesIO(json.dumps({"data": {"ok": True}}).encode())
    with patch("urllib.request.urlopen", side_effect=[urllib.error.HTTPError("url", 503, "unavailable", {}, None), response]) as open_url, patch("time.sleep") as sleep, patch.object(lin, "key", return_value="test-key"):
        assert lin.gql("{ ok }") == {"ok": True}
    assert open_url.call_count == 2
    sleep.assert_called_once()
