from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_apply_signoff import synthesize_code_apply_signoff


def _build_record_prompt(result: dict[str, Any]) -> str:
    lines = [
        f"# Code apply record for {result['proposal_id']}",
        "",
        "You are recording the final post-apply and post-merge record for a LINE Desktop patrol proposal after the human signoff step.",
        "",
        "Record requirements:",
    ]
    for item in result.get("record_requirements") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "Validation commands:",
    ])
    for command in result.get("validation_commands") or []:
        lines.append(f"- {command}")
    lines.extend([
        "",
        "Stop conditions:",
    ])
    for item in result.get("stop_conditions") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def _build_record_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code apply record for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_apply_signoff_path: {result.get('code_apply_signoff_path') or '-'}",
        f"- code_apply_signoff_markdown_path: {result.get('code_apply_signoff_markdown_path') or '-'}",
        f"- signoff_prompt_path: {result.get('signoff_prompt_path') or '-'}",
        f"- code_apply_evidence_path: {result.get('code_apply_evidence_path') or '-'}",
        f"- code_review_packet_path: {result.get('code_review_packet_path') or '-'}",
        f"- patch_document_path: {result.get('patch_document_path') or '-'}",
        "",
        "## Record requirements",
    ]
    for item in result.get("record_requirements") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Expected outputs",
    ])
    for item in result.get("expected_outputs") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Validation commands",
    ])
    for command in result.get("validation_commands") or []:
        lines.append(f"- `{command}`")
    lines.extend([
        "",
        "## Stop conditions",
    ])
    for item in result.get("stop_conditions") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def synthesize_code_apply_record(
    *,
    proposal_id: str,
    queue_root: str | Path,
    repo_root: str | Path,
    base_ref: str = "origin/main",
    branch_name: str | None = None,
    worktree_path: str | Path | None = None,
    create_draft_pr: bool = False,
    allow_high_risk_open: bool = False,
    max_preview_lines: int = 60,
    max_preview_chars: int = 4000,
    runner: Any | None = None,
) -> dict[str, Any]:
    signoff_bundle = synthesize_code_apply_signoff(
        proposal_id=proposal_id,
        queue_root=queue_root,
        repo_root=repo_root,
        base_ref=base_ref,
        branch_name=branch_name,
        worktree_path=worktree_path,
        create_draft_pr=create_draft_pr,
        allow_high_risk_open=allow_high_risk_open,
        max_preview_lines=max_preview_lines,
        max_preview_chars=max_preview_chars,
        runner=runner,
    )
    resolved_queue_root = Path(signoff_bundle["queue_root"]).resolve()
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_apply_record",
        "repo_root": signoff_bundle.get("repo_root"),
        "queue_root": signoff_bundle.get("queue_root"),
        "worktree_path": signoff_bundle.get("worktree_path"),
        "branch_name": signoff_bundle.get("branch_name"),
        "code_apply_signoff_path": signoff_bundle.get("code_apply_signoff_path"),
        "code_apply_signoff_markdown_path": signoff_bundle.get("code_apply_signoff_markdown_path"),
        "signoff_prompt_path": signoff_bundle.get("signoff_prompt_path"),
        "code_apply_evidence_path": signoff_bundle.get("code_apply_evidence_path"),
        "code_review_packet_path": signoff_bundle.get("code_review_packet_path"),
        "patch_document_path": signoff_bundle.get("patch_document_path"),
        "validation_commands": signoff_bundle.get("validation_commands") or [],
        "record_requirements": [
            "Record the final approver name, decision timestamp, and go or no-go outcome from the signoff step.",
            "Record the final merge commit, draft PR update, or explicit no-merge reason that closed the loop.",
            "Record the final validation summary, including any skipped commands with explicit reason.",
            "Record the rollback confirmation and any follow-up owner or ticket that remains after signoff.",
        ],
        "expected_outputs": [
            "A machine-readable post-apply record with signoff outcome, merge or follow-up reference, validation summary, and rollback note.",
            "A markdown closure summary that names the final disposition, changed scope, and any remaining follow-up items.",
            "A final prompt that can be handed to the operator before the proposal loop is marked complete.",
        ],
        "stop_conditions": [
            "Stop if the signoff bundle is missing approver outcome, evidence references, or validation commands.",
            "Stop if the final merge or follow-up reference does not match the approved worktree scope.",
            "Stop if the final record would widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_apply_record.json"
    md_path = promotions_root / f"{proposal_id}.code_apply_record.md"
    prompt_path = promotions_root / f"{proposal_id}.code_apply_record.prompt.md"
    record_prompt = _build_record_prompt(result)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_record_markdown(result), encoding="utf-8")
    prompt_path.write_text(record_prompt, encoding="utf-8")
    result["record_prompt"] = record_prompt
    result["code_apply_record_path"] = str(json_path)
    result["code_apply_record_markdown_path"] = str(md_path)
    result["record_prompt_path"] = str(prompt_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a final code apply record bundle from one queued LINE Desktop patrol proposal.")
    parser.add_argument("--proposal-id", required=True, help="Proposal id from queue.jsonl.")
    parser.add_argument("--queue-root", default="artifacts/line_desktop_patrol/proposals", help="Directory containing queue.jsonl and packets.")
    parser.add_argument("--repo-root", default=".", help="Repository root used for git/gh commands.")
    parser.add_argument("--base-ref", default="origin/main", help="Base ref used for worktree creation and draft PRs.")
    parser.add_argument("--branch-name", default=None, help="Optional branch name override.")
    parser.add_argument("--worktree-path", default=None, help="Optional explicit worktree path.")
    parser.add_argument("--create-draft-pr", action="store_true", help="Create a draft PR when the prepared branch already has a code diff.")
    parser.add_argument("--allow-high-risk-open", action="store_true", help="Allow draft PR creation for high risk proposals.")
    parser.add_argument("--max-preview-lines", type=int, default=60, help="Maximum file preview line count per candidate edit.")
    parser.add_argument("--max-preview-chars", type=int, default=4000, help="Maximum preview character count per candidate edit.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = synthesize_code_apply_record(
        proposal_id=args.proposal_id,
        queue_root=args.queue_root,
        repo_root=args.repo_root,
        base_ref=args.base_ref,
        branch_name=args.branch_name,
        worktree_path=args.worktree_path,
        create_draft_pr=args.create_draft_pr,
        allow_high_risk_open=args.allow_high_risk_open,
        max_preview_lines=args.max_preview_lines,
        max_preview_chars=args.max_preview_chars,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
