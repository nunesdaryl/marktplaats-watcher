from pathlib import Path


def test_feedback_ships_after_production_smoke():
    gate = (Path(__file__).resolve().parents[1] / "factory-merge.sh").read_text()
    assert gate.index('wait_production "$merge_sha"') < gate.index('[[ $code == 401 ]]') < gate.index('feedback:shipByIssue')
    # The merge is live and recorded before feedback ships, and the Linear close happens first:
    # a feedback failure only warns and can never stop the close or trigger the failure restore.
    assert gate.index('python3 scripts/factory/lin.py finish') < gate.index('feedback:shipByIssue')
    ship_block = gate[gate.index('feedback:shipByIssue'):gate.index('Feedback to close')]
    assert 'fail ' not in ship_block and 'WARNING' in gate[gate.index('feedback:shipByIssue'):]


def test_dispatch_never_blocks_on_feedback():
    dispatch = (Path(__file__).resolve().parents[0] / "dispatch.sh").read_text()
    assert 'if feedback_count=$(cd frontend && npx convex run --prod feedback:advanceByIssue' in dispatch
    assert 'build continues' in dispatch
