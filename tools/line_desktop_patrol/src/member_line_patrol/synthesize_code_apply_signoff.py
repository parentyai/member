from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_apply_evidence import synthesize_code_apply_evidence


def _build_signoff_prompt(result: dict[str, Any]) -> str:
    lines = [
        f"# Code apply signoff for {result['proposal_id']}",
        "",
        "You are preparing the final human signoff after the reviewed apply step and evidence capture for a LINE Desktop patrol proposal.",
        "",
        "Signoff requirements:",
    ]
    for item in result.get("signoff_requirements") or []:
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


def _build_signoff_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code apply signoff for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_apply_evidence_path: {result.get('code_apply_evidence_path') or '-'}",
        f"- code_apply_evidence_markdown_path: {result.get('code_apply_evidence_markdown_path') or '-'}",
        f"- evidence_prompt_path: {result.get('evidence_prompt_path') or '-'}",
        f"- code_review_packet_path: {result.get('code_review_packet_path') or '-'}",
        f"- patch_document_path: {result.get('patch_document_path') or '-'}",
        "",
        "## Signoff requirements",
    ]
    for item in result.get("signoff_requirements") or []:
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


def synthesize_code_apply_signoff(
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
    apply_evidence = synthesize_code_apply_evidence(
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
    resolved_queue_root = Path(apply_evidence["queue_root"]).resolve()
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_apply_signoff",
        "repo_root": apply_evidence.get("repo_root"),
        "queue_root": apply_evidence.get("queue_root"),
        "worktree_path": apply_evidence.get("worktree_path"),
        "branch_name": apply_evidence.get("branch_name"),
        "code_apply_evidence_path": apply_evidence.get("code_apply_evidence_path"),
        "code_apply_evidence_markdown_path": apply_evidence.get("code_apply_evidence_markdown_path"),
        "evidence_prompt_path": apply_evidence.get("evidence_prompt_path"),
        "code_review_packet_path": apply_evidence.get("code_review_packet_path"),
        "patch_document_path": apply_evidence.get("patch_document_path"),
        "validation_commands": apply_evidence.get("validation_commands") or [],
        "signoff_requirements": [
            "Record the approver name, timestamp, and final go or no-go decision.",
            "Record the exact evidence bundle paths that back the reviewed apply result.",
            "Record the final validation summary, including any skipped commands with explicit reason.",
            "Record the rollback note and draft PR update note that match the final changed file set.",
        ],
        "expected_outputs": [
            "A machine-readable signoff record with approver metadata, evidence references, and final decision.",
            "A markdown signoff summary that lists the final changed files and validation outcomes.",
            "A final signoff prompt that can be handed to a reviewer before any draft PR update or manual apply follow-up.",
        ],
        "stop_conditions": [
            "Stop if the code apply evidence bundle is missing required patch or validation references.",
            "Stop if any required validation command failed or was skipped without a recorded reason.",
            "Stop if the final changed files widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_apply_signoff.json"
    md_path = promotions_root / f"{proposal_id}.code_apply_signoff.md"
    prompt_path = promotions_root / f"{proposal_id}.code_apply_signoff.prompt.md"
    signoff_prompt = _build_signoff_prompt(result)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_signoff_markdown(result), encoding="utf-8")
    prompt_path.write_text(signoff_prompt, encoding="utf-8")
    result["signoff_prompt"] = signoff_prompt
    result["code_apply_signoff_path"] = str(json_path)
    result["code_apply_signoff_markdown_path"] = str(md_path)
    result["signoff_prompt_path"] = str(prompt_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a final human signoff bundle from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_apply_signoff(
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
