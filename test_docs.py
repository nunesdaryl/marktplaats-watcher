"""Checks for the architecture decision index."""
from pathlib import Path


def test_every_adr_is_linked_from_index():
    adr_dir = Path(__file__).parent / "docs" / "adr"
    index = (adr_dir / "README.md").read_text()
    records = sorted(adr_dir.glob("0*.md"))
    assert records
    for record in records:
        assert f"]({record.name})" in index, f"{record.name} is missing from the ADR index"
