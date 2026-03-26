from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .proposal_builder import build_queue_payloads, read_json_file
from .proposal_queue import ProposalQueue


def _write_packet(packet_root: Path, proposal_id: str, payload: dict[str, Any]) -> Path:
    packet_root.mkdir(parents=True, exist_ok=True)
    output_path = packet_root / f"{proposal_id}.codex.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return output_path


def _write_linkage(trace_path: Path, payload: dict[str, Any]) -> Path:
    output_path = trace_path.parent / "proposal_linkage.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return output_path


def enqueue_eval_proposals(
    *,
    trace_path: str | Path,
    planning_artifact_path: str | Path,
    queue_root: str | Path,
    main_artifact_path: str | Path | None = None,
) -> dict[str, Any]:
    resolved_trace_path = Path(trace_path).resolve()
    resolved_planning_path = Path(planning_artifact_path).resolve()
    resolved_main_path = Path(main_artifact_path).resolve() if main_artifact_path else None
    resolved_queue_root = Path(queue_root).resolve()

    trace = read_json_file(resolved_trace_path)
    planning_artifact = read_json_file(resolved_planning_path)
    main_artifact = read_json_file(resolved_main_path) if resolved_main_path else {}

    queue = ProposalQueue(resolved_queue_root / "queue.jsonl")
    payloads = build_queue_payloads(
        trace=trace,
        planning_artifact=planning_artifact,
        main_artifact=main_artifact,
        trace_path=resolved_trace_path,
        planning_artifact_path=resolved_planning_path,
        main_artifact_path=resolved_main_path,
    )

    queued_ids: list[str] = []
    duplicate_ids: list[str] = []
    packet_paths: list[str] = []
    packet_root = resolved_queue_root / "packets"

    for item in payloads:
        queue_entry = item["queue_entry"]
        proposal_id = str(queue_entry["proposal_id"])
        inserted = queue.enqueue(queue_entry)
        packet_path = _write_packet(packet_root, proposal_id, item["codex_packet"])
        packet_paths.append(str(packet_path))
        if inserted:
            queued_ids.append(proposal_id)
        else:
            duplicate_ids.append(proposal_id)

    linkage = {
        "ok": True,
        "run_id": trace.get("run_id"),
        "trace_path": str(resolved_trace_path),
        "planning_artifact_path": str(resolved_planning_path),
        "main_artifact_path": str(resolved_main_path) if resolved_main_path else None,
        "queue_path": str(queue.queue_path),
        "queued_proposal_ids": queued_ids,
        "duplicate_proposal_ids": duplicate_ids,
        "packet_paths": packet_paths,
    }
    linkage_path = _write_linkage(resolved_trace_path, linkage)
    return {
        "ok": True,
        "queuePath": str(queue.queue_path),
        "linkagePath": str(linkage_path),
        "queuedCount": len(queued_ids),
        "duplicateCount": len(duplicate_ids),
        "queuedProposalIds": queued_ids,
        "duplicateProposalIds": duplicate_ids,
        "packetPaths": packet_paths,
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Append desktop patrol proposals into a local review queue and write Codex packets.")
    parser.add_argument("--trace", required=True, help="Path to the line desktop patrol trace.json artifact.")
    parser.add_argument("--planning-output", required=True, help="Path to the desktop patrol planning artifact.")
    parser.add_argument("--queue-root", default="artifacts/line_desktop_patrol/proposals", help="Directory for queue.jsonl and Codex packet artifacts.")
    parser.add_argument("--main-output", default=None, help="Optional path to the desktop patrol main artifact.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = enqueue_eval_proposals(
        trace_path=args.trace,
        planning_artifact_path=args.planning_output,
        queue_root=args.queue_root,
        main_artifact_path=args.main_output,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
