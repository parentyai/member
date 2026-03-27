from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_edit_task import synthesize_code_edit_task


def _build_diff_stub(task: dict[str, Any]) -> dict[str, Any]:
    file_path = task.get("file_path")
    patch_shape = str(task.get("patch_shape") or "update_file").strip() or "update_file"
    anchor_preview = task.get("anchor_preview")
    edit_goal = task.get("edit_goal") or "Draft the smallest reversible diff that satisfies the queued proposal."
    if patch_shape == "inspect_before_add":
        template_lines = [
            "*** Begin Patch",
            f"*** Add File: {file_path or 'REPLACE_ME'}",
            "+ <write the new file content here>",
            "*** End Patch",
        ]
    else:
        template_lines = [
            "*** Begin Patch",
            f"*** Update File: {file_path or 'REPLACE_ME'}",
            "@@",
            f"- {anchor_preview or '<copy the current anchor block here>'}",
            f"+ <replace with the minimal block for {task.get('task_id') or 'edit_task'}>",
            "*** End Patch",
        ]
    return {
        "task_id": task.get("task_id"),
        "file_path": file_path,
        "workspace_file_path": task.get("workspace_file_path"),
        "patch_shape": patch_shape,
        "draft_summary": edit_goal,
        "anchor_preview": anchor_preview,
        "draft_patch_lines": template_lines,
        "review_prompts": [
            f"Confirm {file_path or 'the target file'} still contains the preview anchor before applying the draft.",
            "Fill every placeholder with concrete lines from the prepared worktree before applying.",
            "Keep the draft inside the current candidate file set unless proposal evidence changes.",
        ],
    }


def _build_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code diff draft for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_edit_task_path: {result.get('code_edit_task_path') or '-'}",
        f"- code_edit_task_markdown_path: {result.get('code_edit_task_markdown_path') or '-'}",
        f"- code_patch_bundle_path: {result.get('code_patch_bundle_path') or '-'}",
        f"- patch_request_path: {result.get('patch_request_path') or '-'}",
        "",
        "## Validation commands",
    ]
    for command in result.get("validation_commands") or []:
        lines.append(f"- `{command}`")
    lines.extend([
        "",
        "## Diff tasks",
    ])
    for task in result.get("diff_tasks") or []:
        lines.append(f"- {task.get('file_path') or '(choose file after inspection)'}")
        lines.append(f"  task_id: {task.get('task_id')}")
        lines.append(f"  patch_shape: {task.get('patch_shape')}")
        lines.append(f"  anchor_preview: {task.get('anchor_preview') or '-'}")
        lines.append(f"  draft_summary: {task.get('draft_summary') or '-'}")
        lines.append("  draft_patch_lines:")
        for draft_line in task.get("draft_patch_lines") or []:
            lines.append(f"    {draft_line}")
    lines.extend([
        "",
        "## Review checklist",
    ])
    for item in result.get("review_checklist") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Stop conditions",
    ])
    for item in result.get("stop_conditions") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def synthesize_code_diff_draft(
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
    code_edit_task = synthesize_code_edit_task(
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
    resolved_queue_root = Path(code_edit_task["queue_root"]).resolve()
    diff_tasks = [_build_diff_stub(task) for task in (code_edit_task.get("edit_tasks") or [])]
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_diff_draft",
        "repo_root": code_edit_task.get("repo_root"),
        "queue_root": code_edit_task.get("queue_root"),
        "worktree_path": code_edit_task.get("worktree_path"),
        "branch_name": code_edit_task.get("branch_name"),
        "patch_request_path": code_edit_task.get("patch_request_path"),
        "patch_draft_path": code_edit_task.get("patch_draft_path"),
        "code_patch_bundle_path": code_edit_task.get("code_patch_bundle_path"),
        "code_patch_bundle_markdown_path": code_edit_task.get("code_patch_bundle_markdown_path"),
        "code_edit_task_path": code_edit_task.get("code_edit_task_path"),
        "code_edit_task_markdown_path": code_edit_task.get("code_edit_task_markdown_path"),
        "validation_commands": code_edit_task.get("validation_commands") or [],
        "diff_tasks": diff_tasks,
        "review_checklist": [
            "Replace every placeholder in the draft patch before applying anything.",
            "Re-read the target file in the prepared worktree immediately before applying the draft.",
            "Keep the diff inside the current proposal evidence and candidate file set.",
            "Run the listed validation commands before opening or updating a draft PR.",
        ],
        "stop_conditions": [
            "Stop if the current file content no longer matches the stored anchor preview.",
            "Stop if the draft needs files outside the current candidate set without updated evidence.",
            "Stop if the draft would widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_diff_draft.json"
    md_path = promotions_root / f"{proposal_id}.code_diff_draft.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_markdown(result), encoding="utf-8")
    result["code_diff_draft_path"] = str(json_path)
    result["code_diff_draft_markdown_path"] = str(md_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code diff draft from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_diff_draft(
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
