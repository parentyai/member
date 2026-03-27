from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_apply_task import synthesize_code_apply_task


def _build_review_prompt(result: dict[str, Any]) -> str:
    lines = [
        f"# Code review packet for {result['proposal_id']}",
        "",
        "You are reviewing the final human-operated apply_patch task for a LINE Desktop patrol proposal.",
        "",
        "Review goals:",
        "- Confirm the patch stays inside the prepared write set.",
        "- Confirm every placeholder is resolved before any apply step.",
        "- Confirm every validation command is run or explicitly skipped with reason.",
        "- Confirm rollback and stop conditions are still intact before approval.",
        "",
        "Artifacts:",
        f"- code_apply_task_path: {result.get('code_apply_task_path') or '-'}",
        f"- patch_document_path: {result.get('patch_document_path') or '-'}",
        f"- task_prompt_path: {result.get('task_prompt_path') or '-'}",
        "",
        "Approval checklist:",
    ]
    for item in result.get("approval_checklist") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "Stop conditions:",
    ])
    for item in result.get("stop_conditions") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def _build_review_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code review packet for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_apply_task_path: {result.get('code_apply_task_path') or '-'}",
        f"- code_apply_task_markdown_path: {result.get('code_apply_task_markdown_path') or '-'}",
        f"- patch_document_path: {result.get('patch_document_path') or '-'}",
        f"- task_prompt_path: {result.get('task_prompt_path') or '-'}",
        f"- review_prompt_path: {result.get('review_prompt_path') or '-'}",
        "",
        "## Approval checklist",
    ]
    for item in result.get("approval_checklist") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Expected review outputs",
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


def synthesize_code_review_packet(
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
    code_apply_task = synthesize_code_apply_task(
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
    resolved_queue_root = Path(code_apply_task["queue_root"]).resolve()
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_code_review_packet",
        "repo_root": code_apply_task.get("repo_root"),
        "queue_root": code_apply_task.get("queue_root"),
        "worktree_path": code_apply_task.get("worktree_path"),
        "branch_name": code_apply_task.get("branch_name"),
        "code_apply_task_path": code_apply_task.get("code_apply_task_path"),
        "code_apply_task_markdown_path": code_apply_task.get("code_apply_task_markdown_path"),
        "patch_document_path": code_apply_task.get("patch_document_path"),
        "task_prompt_path": code_apply_task.get("worker_prompt_path"),
        "validation_commands": code_apply_task.get("validation_commands") or [],
        "approval_checklist": [
            "Confirm the prepared write set still matches the patch document and current worktree.",
            "Confirm every placeholder in the patch document is resolved before approval.",
            "Confirm every validation command is executed or skipped with explicit reason after apply.",
            "Confirm the rollback note still matches the intended file set and scope.",
        ],
        "expected_outputs": [
            "A final approval note that names the reviewed write set and any deviations.",
            "A validation summary that records every command outcome after the reviewed apply step.",
            "A reviewer signoff note with rollback guidance before any draft PR update.",
        ],
        "stop_conditions": [
            "Stop if the write set changed since the code apply task was generated.",
            "Stop if any placeholder remains unresolved in the patch document.",
            "Stop if the final patch would widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_review_packet.json"
    md_path = promotions_root / f"{proposal_id}.code_review_packet.md"
    prompt_path = promotions_root / f"{proposal_id}.code_review_packet.prompt.md"
    review_prompt = _build_review_prompt(result)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_review_markdown({**result, "review_prompt_path": str(prompt_path)}), encoding="utf-8")
    prompt_path.write_text(review_prompt, encoding="utf-8")
    result["review_prompt"] = review_prompt
    result["code_review_packet_path"] = str(json_path)
    result["code_review_packet_markdown_path"] = str(md_path)
    result["review_prompt_path"] = str(prompt_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code review packet from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_review_packet(
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
