from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_code_edit_bundle import synthesize_code_edit_bundle


def _build_patch_document(task_packets: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for task in task_packets:
        for row in task.get("draft_patch_lines") or []:
            lines.append(str(row))
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _build_apply_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code apply draft for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        "",
        "## Upstream artifacts",
        f"- code_edit_bundle_path: {result.get('code_edit_bundle_path') or '-'}",
        f"- code_edit_bundle_markdown_path: {result.get('code_edit_bundle_markdown_path') or '-'}",
        f"- worker_prompt_path: {result.get('worker_prompt_path') or '-'}",
        f"- patch_document_path: {result.get('patch_document_path') or '-'}",
        "",
        "## Expected outputs",
    ]
    for item in result.get("expected_outputs") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Apply steps",
    ])
    for item in result.get("apply_steps") or []:
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


def synthesize_code_apply_draft(
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
    code_edit_bundle = synthesize_code_edit_bundle(
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
    resolved_queue_root = Path(code_edit_bundle["queue_root"]).resolve()
    task_packets = code_edit_bundle.get("task_packets") or []
    patch_document = _build_patch_document(task_packets)
    result = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_apply_review",
        "repo_root": code_edit_bundle.get("repo_root"),
        "queue_root": code_edit_bundle.get("queue_root"),
        "worktree_path": code_edit_bundle.get("worktree_path"),
        "branch_name": code_edit_bundle.get("branch_name"),
        "code_edit_bundle_path": code_edit_bundle.get("code_edit_bundle_path"),
        "code_edit_bundle_markdown_path": code_edit_bundle.get("code_edit_bundle_markdown_path"),
        "worker_prompt_path": code_edit_bundle.get("worker_prompt_path"),
        "validation_commands": code_edit_bundle.get("validation_commands") or [],
        "task_packets": task_packets,
        "expected_outputs": [
            "A reviewed apply_patch payload with placeholders resolved against the prepared worktree.",
            "A validation log that records every command run after the draft is applied.",
            "A concise reviewer summary of the exact files changed and why.",
        ],
        "apply_steps": [
            "Review the worker prompt and the current write set before touching any file.",
            "Replace every placeholder in the patch document with concrete lines from the prepared worktree.",
            "Review the patch document with a human before applying it.",
            "Run the listed validation commands after applying the reviewed patch.",
        ],
        "stop_conditions": [
            "Stop if any placeholder remains unresolved in the patch document.",
            "Stop if the patch needs files outside the prepared write set without refreshed evidence.",
            "Stop if the patch would widen runtime authority, tracked sample policy defaults, or whitelist scope.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    json_path = promotions_root / f"{proposal_id}.code_apply_draft.json"
    md_path = promotions_root / f"{proposal_id}.code_apply_draft.md"
    patch_path = promotions_root / f"{proposal_id}.code_apply_draft.patch"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_build_apply_markdown({**result, "patch_document_path": str(patch_path)}), encoding="utf-8")
    patch_path.write_text(patch_document, encoding="utf-8")
    result["patch_document_path"] = str(patch_path)
    result["code_apply_draft_path"] = str(json_path)
    result["code_apply_draft_markdown_path"] = str(md_path)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code apply draft from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_apply_draft(
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
