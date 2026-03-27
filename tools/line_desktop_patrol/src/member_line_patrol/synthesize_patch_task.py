from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any, Callable

from .promote_proposal import promote_proposal
from .proposal_builder import read_json_file


def _string_list(values: Any) -> list[str]:
    rows = values if isinstance(values, list) else ([values] if values else [])
    out: list[str] = []
    seen: set[str] = set()
    for item in rows:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _suggest_validation_commands(packet: dict[str, Any], queue_entry: dict[str, Any]) -> list[str]:
    affected_files = _string_list(queue_entry.get("affected_files"))
    commands = ["npm run line-desktop-patrol:validate"]
    if any(path.startswith("tools/line_desktop_patrol/") for path in affected_files):
        commands.append("python3 -m compileall tools/line_desktop_patrol/src")
        commands.append("npm run test:phase871")
    if any(path.startswith("docs/") for path in affected_files):
        commands.append("npm run test:docs")
        commands.append("npm run catchup:drift-check")
    if any(path.startswith("src/usecases/qualityPatrol/") or path.startswith("src/domain/qualityPatrol/") for path in affected_files):
        commands.append("npm run test:phase860")
        commands.append("npm run test:phase869")
    if any(path.startswith("apps/admin/") for path in affected_files):
        commands.append("npm run test:admin-nav-contract")
    if packet.get("trace_ref"):
        commands.append("npm run line-desktop-patrol:evaluate -- --trace <trace_path> --planning-output /tmp/line_desktop_patrol_planning.json")
    deduped: list[str] = []
    seen: set[str] = set()
    for command in commands:
        if command in seen:
            continue
        seen.add(command)
        deduped.append(command)
    return deduped


def _candidate_edits(packet: dict[str, Any], queue_entry: dict[str, Any]) -> list[dict[str, Any]]:
    proposal = packet.get("proposal") if isinstance(packet.get("proposal"), dict) else {}
    affected_files = _string_list(queue_entry.get("affected_files"))
    root_cause_refs = _string_list(proposal.get("root_cause_refs"))
    expected_impact = _string_list(proposal.get("expected_impact"))
    if not affected_files:
        return [{
            "file_path": None,
            "action": "inspect_then_patch",
            "rationale": "No affected_files were supplied. Inspect the trace, evaluation, and proposal packet before choosing a minimal write set.",
        }]
    rationale_bits = []
    if root_cause_refs:
        rationale_bits.append(f"root_cause_refs={', '.join(root_cause_refs)}")
    if expected_impact:
        rationale_bits.append(f"expected_impact={', '.join(expected_impact)}")
    rationale = "; ".join(rationale_bits) or "Use the linked execute trace and proposal packet to keep changes minimally invasive."
    return [{
        "file_path": file_path,
        "action": "inspect_then_patch",
        "rationale": rationale,
    } for file_path in affected_files]


def _build_patch_request_markdown(result: dict[str, Any]) -> str:
    queue_entry = result.get("queue_entry") if isinstance(result.get("queue_entry"), dict) else {}
    packet = result.get("packet") if isinstance(result.get("packet"), dict) else {}
    trace_ref = packet.get("trace_ref") if isinstance(packet.get("trace_ref"), dict) else {}
    evaluation_ref = packet.get("evaluation_ref") if isinstance(packet.get("evaluation_ref"), dict) else {}
    operator_summary = packet.get("operator_summary") if isinstance(packet.get("operator_summary"), dict) else {}
    lines = [
        f"# Patch synthesis bundle for {result['proposal_id']}",
        "",
        "## Worktree",
        f"- branch_name: {result.get('branch_name') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- promotion_status: {result.get('promotion_status') or '-'}",
        f"- draft_pr_ref: {result.get('draft_pr_ref') or '-'}",
        "",
        "## Source evidence",
        f"- run_id: {trace_ref.get('run_id') or '-'}",
        f"- trace_path: {trace_ref.get('trace_path') or '-'}",
        f"- scenario_id: {trace_ref.get('scenario_id') or '-'}",
        f"- failure_reason: {trace_ref.get('failure_reason') or '-'}",
        f"- planning_status: {evaluation_ref.get('planning_status') or '-'}",
        f"- observation_status: {evaluation_ref.get('observation_status') or '-'}",
        "",
        "## Operator summary",
        f"- headline: {operator_summary.get('headline') or '-'}",
        f"- status: {operator_summary.get('status') or '-'}",
        f"- expected_score_delta: {queue_entry.get('expected_score_delta')}",
        "",
        "## Candidate edits",
    ]
    for item in result.get("candidate_edits") or []:
        lines.append(f"- {item.get('file_path') or '(choose file after inspection)'}")
        lines.append(f"  rationale: {item.get('rationale') or '-'}")
        lines.append(f"  action: {item.get('action') or '-'}")
    lines.extend([
        "",
        "## Validation commands",
    ])
    for command in result.get("validation_commands") or []:
        lines.append(f"- `{command}`")
    lines.extend([
        "",
        "## Stop conditions",
        "- Do not broaden the target beyond the queued proposal scope.",
        "- Do not auto-apply runtime or routing changes without human review.",
        "- If evidence no longer matches the proposal packet, stop and regenerate promotion artifacts.",
        "",
        "## Rollback note",
        "- Revert the patch branch or discard the worktree if the synthesized patch is not adopted.",
    ])
    return "\n".join(lines)


def synthesize_patch_task(
    *,
    proposal_id: str,
    queue_root: str | Path,
    repo_root: str | Path,
    base_ref: str = "origin/main",
    branch_name: str | None = None,
    worktree_path: str | Path | None = None,
    create_draft_pr: bool = False,
    allow_high_risk_open: bool = False,
    runner: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    promotion = promote_proposal(
        proposal_id=proposal_id,
        queue_root=queue_root,
        repo_root=repo_root,
        base_ref=base_ref,
        branch_name=branch_name,
        worktree_path=worktree_path,
        create_draft_pr=create_draft_pr,
        allow_high_risk_open=allow_high_risk_open,
        runner=runner,
    )
    queue_root_path = Path(promotion["queue_root"]).resolve()
    promotions_root = queue_root_path / "promotions"
    packet = read_json_file(promotion["packet_path"])
    queue_entry = promotion["queue_entry"] if isinstance(promotion.get("queue_entry"), dict) else {}
    validation_commands = _suggest_validation_commands(packet, queue_entry)
    candidate_edits = _candidate_edits(packet, queue_entry)
    synthesis = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_patch",
        "queue_root": str(queue_root_path),
        "promotion_record_path": promotion["record_path"],
        "packet_path": promotion["packet_path"],
        "patch_draft_path": promotion["patch_draft_path"],
        "draft_pr_body_path": promotion["body_path"],
        "branch_name": promotion["branch_name"],
        "worktree_path": promotion["worktree_path"],
        "promotion_status": promotion["status"],
        "draft_pr_ref": promotion.get("draft_pr_ref"),
        "queue_entry": queue_entry,
        "packet": packet,
        "validation_commands": validation_commands,
        "candidate_edits": candidate_edits,
        "operator_instructions": [
            "Review the linked trace, evaluation artifact, and patch draft before writing code.",
            "Keep edits add-only or minimally invasive.",
            "Do not commit or open a PR until the synthesized patch passes the suggested validation commands.",
        ],
    }
    synthesis_json_path = promotions_root / f"{proposal_id}.patch_request.json"
    synthesis_md_path = promotions_root / f"{proposal_id}.patch_request.md"
    synthesis_json_path.write_text(json.dumps(synthesis, ensure_ascii=False, indent=2), encoding="utf-8")
    synthesis_md_path.write_text(_build_patch_request_markdown(synthesis), encoding="utf-8")
    synthesis["patch_request_path"] = str(synthesis_json_path)
    synthesis["patch_request_markdown_path"] = str(synthesis_md_path)
    return synthesis


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed patch synthesis bundle for one queued LINE Desktop patrol proposal.")
    parser.add_argument("--proposal-id", required=True, help="Proposal id from queue.jsonl.")
    parser.add_argument("--queue-root", default="artifacts/line_desktop_patrol/proposals", help="Directory containing queue.jsonl and packets.")
    parser.add_argument("--repo-root", default=".", help="Repository root used for git/gh commands.")
    parser.add_argument("--base-ref", default="origin/main", help="Base ref used for worktree creation and draft PRs.")
    parser.add_argument("--branch-name", default=None, help="Optional branch name override.")
    parser.add_argument("--worktree-path", default=None, help="Optional explicit worktree path.")
    parser.add_argument("--create-draft-pr", action="store_true", help="Create a draft PR when the prepared branch already has a code diff.")
    parser.add_argument("--allow-high-risk-open", action="store_true", help="Allow draft PR creation for high risk proposals.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = synthesize_patch_task(
        proposal_id=args.proposal_id,
        queue_root=args.queue_root,
        repo_root=args.repo_root,
        base_ref=args.base_ref,
        branch_name=args.branch_name,
        worktree_path=args.worktree_path,
        create_draft_pr=args.create_draft_pr,
        allow_high_risk_open=args.allow_high_risk_open,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
