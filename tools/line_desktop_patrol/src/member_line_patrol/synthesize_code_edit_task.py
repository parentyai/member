from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_patch_bundle import synthesize_code_patch_bundle


def _first_anchor_line(preview: Any) -> str | None:
    if not isinstance(preview, str):
        return None
    for line in preview.splitlines():
        text = line.strip()
        if text:
            return text[:200]
    return None


def _build_edit_task(snapshot: dict[str, Any], index: int) -> dict[str, Any]:
    file_path = snapshot.get("file_path")
    anchor = _first_anchor_line(snapshot.get("preview"))
    patch_shape = "update_file" if snapshot.get("exists") else "inspect_before_add"
    return {
        "task_id": f"edit_{index:02d}",
        "file_path": file_path,
        "workspace_file_path": snapshot.get("workspace_file_path"),
        "patch_shape": patch_shape,
        "anchor_preview": anchor,
        "edit_goal": snapshot.get("rationale") or "Patch the file minimally to satisfy the queued proposal.",
        "operator_steps": [
            f"Open {file_path or 'the target file'} in the prepared worktree.",
            "Inspect the preview anchor and surrounding lines before editing.",
            "Apply the minimal reversible change that matches the proposal evidence.",
        ],
        "apply_patch_hint": {
            "kind": patch_shape,
            "target_file": file_path,
            "anchor_preview": anchor,
            "template_lines": [
                "*** Begin Patch",
                f"*** {'Update' if patch_shape == 'update_file' else 'Add'} File: {file_path or 'REPLACE_ME'}",
                "@@",
                "- <copy existing anchor block here>",
                "+ <write the minimal replacement here>",
                "*** End Patch",
            ],
        },
    }


def _build_edit_task_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code edit task for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_patch_bundle_path: {result.get('code_patch_bundle_path') or '-'}",
        f"- code_patch_bundle_markdown_path: {result.get('code_patch_bundle_markdown_path') or '-'}",
        f"- patch_request_path: {result.get('patch_request_path') or '-'}",
        f"- patch_draft_path: {result.get('patch_draft_path') or '-'}",
        "",
        "## Validation commands",
    ]
    for command in result.get("validation_commands") or []:
        lines.append(f"- `{command}`")
    lines.extend([
        "",
        "## Edit tasks",
    ])
    for task in result.get("edit_tasks") or []:
        lines.append(f"- {task.get('file_path') or '(choose file after inspection)'}")
        lines.append(f"  task_id: {task.get('task_id')}")
        lines.append(f"  patch_shape: {task.get('patch_shape')}")
        lines.append(f"  anchor_preview: {task.get('anchor_preview') or '-'}")
        lines.append(f"  edit_goal: {task.get('edit_goal') or '-'}")
        lines.append("  apply_patch_hint:")
        for hint_line in (task.get("apply_patch_hint", {}).get("template_lines") or []):
            lines.append(f"    {hint_line}")
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


def synthesize_code_edit_task(
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
    code_patch_bundle = synthesize_code_patch_bundle(
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
    resolved_queue_root = Path(code_patch_bundle["queue_root"]).resolve()
    edit_tasks = [
        _build_edit_task(snapshot, index)
        for index, snapshot in enumerate(code_patch_bundle.get("file_snapshots") or [], start=1)
    ]
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_code_edit",
        "repo_root": code_patch_bundle.get("repo_root"),
        "queue_root": code_patch_bundle.get("queue_root"),
        "worktree_path": code_patch_bundle.get("worktree_path"),
        "branch_name": code_patch_bundle.get("branch_name"),
        "patch_request_path": code_patch_bundle.get("patch_request_path"),
        "patch_draft_path": code_patch_bundle.get("patch_draft_path"),
        "code_patch_bundle_path": code_patch_bundle.get("code_patch_bundle_path"),
        "code_patch_bundle_markdown_path": code_patch_bundle.get("code_patch_bundle_markdown_path"),
        "validation_commands": code_patch_bundle.get("validation_commands") or [],
        "edit_tasks": edit_tasks,
        "review_checklist": [
            "Confirm the target file still matches the preview anchor before editing.",
            "Keep the write set inside the candidate files unless the proposal evidence changes.",
            "Run the listed validation commands before commit or draft PR.",
            "Do not widen runtime authority, tracked sample policy defaults, or allowlist scope.",
        ],
        "stop_conditions": [
            "Stop if the prepared worktree no longer matches the patch request evidence.",
            "Stop if the edit requires a new file outside the candidate write set without updated proposal evidence.",
            "Stop if validation failures force a broader refactor than the queued proposal allows.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_edit_task.json"
    md_path = promotions_root / f"{proposal_id}.code_edit_task.md"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_edit_task_markdown(result), encoding="utf-8")
    result["code_edit_task_path"] = str(json_path)
    result["code_edit_task_markdown_path"] = str(md_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code edit task from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_edit_task(
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
