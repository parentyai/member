from __future__ import annotations

from pathlib import Path
import json
from typing import Any, Mapping


class ProposalQueue:
    def __init__(self, queue_path: str | Path) -> None:
        self.queue_path = Path(queue_path)

    def list_entries(self) -> list[dict[str, Any]]:
        if not self.queue_path.exists():
            return []
        lines = self.queue_path.read_text(encoding="utf-8").splitlines()
        entries = []
        for line in lines:
            text = line.strip()
            if not text:
                continue
            entries.append(json.loads(text))
        return entries

    def list_ids(self) -> set[str]:
        return {
            str(entry["proposal_id"])
            for entry in self.list_entries()
            if isinstance(entry, dict) and "proposal_id" in entry
        }

    def enqueue(self, entry: Mapping[str, Any]) -> bool:
        if not isinstance(entry, dict):
            raise ValueError("entry must be an object")
        proposal_id = entry.get("proposal_id")
        if not isinstance(proposal_id, str) or not proposal_id.strip():
            raise ValueError("proposal_id must be a non-empty string")
        if proposal_id in self.list_ids():
            return False
        self.queue_path.parent.mkdir(parents=True, exist_ok=True)
        with self.queue_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(dict(entry), ensure_ascii=False))
            handle.write("\n")
        return True
