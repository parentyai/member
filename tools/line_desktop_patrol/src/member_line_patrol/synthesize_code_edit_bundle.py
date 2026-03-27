from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_diff_draft import synthesize_code_diff_draft


def _build_worker_prompt(result: dict[str, Any]) -> str:
    write_set = [task.get("file_path") for task in (result.get("task_packets") or []) if task.get("file_path")]
    lines = [
        f"# Code edit bundle for {result['proposal_id']}",
        "",
        "You are preparing a minimal, reversible code change from a LINE Desktop patrol proposal.",
        "",
        "Constraints:",
        "- Stay inside the listed write set unless new proposal evidence is generated.",
        "- Do not widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        "- Do not auto-merge, auto-apply, or change external contracts without review.",
        "",
        "Write set:",
    ]
    for file_path in write_set or ["(inspect the worktree before choosing a file)"]:
        lines.append(f"- {file_path}")
    lines.extend([
        "",
        "Expected outputs:",
    ])
    for item in result.get("expected_outputs") or []:
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


def _build_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code edit bundle for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_diff_draft_path: {result.get('code_diff_draft_path') or '-'}",
        f"- code_diff_draft_markdown_path: {result.get('code_diff_draft_markdown_path') or '-'}",
        f"- code_edit_task_path: {result.get('code_edit_task_path') or '-'}",
        f"- patch_request_path: {result.get('patch_request_path') or '-'}",
        "",
        "## Task packets",
    ]
    for task in result.get("task_packets") or []:
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
    lines.extend([
        "",
        "## Worker prompt path",
        f"- {result.get('worker_prompt_path') or '-'}",
    ])
    return "\n".join(lines)


def synthesize_code_edit_bundle(
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
    code_diff_draft = synthesize_code_diff_draft(
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
    resolved_queue_root = Path(code_diff_draft["queue_root"]).resolve()
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_code_edit_bundle",
        "repo_root": code_diff_draft.get("repo_root"),
        "queue_root": code_diff_draft.get("queue_root"),
        "worktree_path": code_diff_draft.get("worktree_path"),
        "branch_name": code_diff_draft.get("branch_name"),
        "patch_request_path": code_diff_draft.get("patch_request_path"),
        "patch_draft_path": code_diff_draft.get("patch_draft_path"),
        "code_edit_task_path": code_diff_draft.get("code_edit_task_path"),
        "code_edit_task_markdown_path": code_diff_draft.get("code_edit_task_markdown_path"),
        "code_diff_draft_path": code_diff_draft.get("code_diff_draft_path"),
        "code_diff_draft_markdown_path": code_diff_draft.get("code_diff_draft_markdown_path"),
        "validation_commands": code_diff_draft.get("validation_commands") or [],
        "task_packets": code_diff_draft.get("diff_tasks") or [],
        "expected_outputs": [
            "A minimal apply_patch payload or equivalent code diff restricted to the listed write set.",
            "A short validation log that shows each listed command was run or intentionally skipped with reason.",
            "A changed-files summary that names every touched file and why it changed.",
        ],
        "stop_conditions": [
            "Stop if the target file no longer matches the captured anchor preview.",
            "Stop if the patch needs files outside the listed task packets without refreshed evidence.",
            "Stop if the patch would widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_edit_bundle.json"
    md_path = promotions_root / f"{proposal_id}.code_edit_bundle.md"
    prompt_path = promotions_root / f"{proposal_id}.code_edit_bundle.prompt.md"
    worker_prompt = _build_worker_prompt(result)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_markdown({**result, "worker_prompt_path": str(prompt_path)}), encoding="utf-8")
    prompt_path.write_text(worker_prompt, encoding="utf-8")
    result["worker_prompt"] = worker_prompt
    result["code_edit_bundle_path"] = str(json_path)
    result["code_edit_bundle_markdown_path"] = str(md_path)
    result["worker_prompt_path"] = str(prompt_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code edit bundle from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_edit_bundle(
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
