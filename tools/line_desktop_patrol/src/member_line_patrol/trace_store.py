from __future__ import annotations

from pathlib import Path
import json
from typing import Any, Mapping


class TraceStore:
    def __init__(self, root_dir: str | Path) -> None:
        self.root_dir = Path(root_dir)

    def run_dir(self, run_id: str) -> Path:
        if not isinstance(run_id, str) or not run_id.strip():
            raise ValueError("run_id must be a non-empty string")
        return self.root_dir / "runs" / run_id.strip()

    def write_trace(self, record: Mapping[str, Any]) -> Path:
        run_id = record.get("run_id")
        run_dir = self.run_dir(str(run_id))
        run_dir.mkdir(parents=True, exist_ok=True)
        output_path = run_dir / "trace.json"
        output_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        return output_path

    def write_json_artifact(self, run_id: str, filename: str, payload: Mapping[str, Any]) -> Path:
        safe_name = Path(filename).name
        if safe_name != filename:
            raise ValueError("filename must not contain directory traversal")
        run_dir = self.run_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        output_path = run_dir / safe_name
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return output_path
