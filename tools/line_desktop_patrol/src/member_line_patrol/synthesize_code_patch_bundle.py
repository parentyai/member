from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .synthesize_patch_task import synthesize_patch_task


def _normalize_path(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _resolve_snapshot_path(
    *,
    repo_root: Path,
    worktree_path: Path | None,
    file_path: str | None,
) -> Path | None:
    if not file_path:
        return None
    candidate = Path(file_path)
    if candidate.is_absolute():
        return candidate
    if worktree_path:
        worktree_candidate = worktree_path / candidate
        if worktree_candidate.exists():
            return worktree_candidate
    repo_candidate = repo_root / candidate
    if repo_candidate.exists():
        return repo_candidate
    return (worktree_path / candidate) if worktree_path else repo_candidate


def _read_preview(path: Path | None, *, max_lines: int, max_chars: int) -> dict[str, Any]:
    if path is None or not path.exists() or not path.is_file():
        return {
            "exists": False,
            "line_count": 0,
            "size_bytes": 0,
            "preview": None,
            "preview_truncated": False,
        }
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    preview_lines = lines[:max_lines]
    preview = "\n".join(preview_lines)
    preview_truncated = len(lines) > max_lines or len(preview) > max_chars
    if len(preview) > max_chars:
        preview = preview[:max_chars].rstrip() + "\n...[truncated]"
    return {
        "exists": True,
        "line_count": len(lines),
        "size_bytes": path.stat().st_size,
        "preview": preview,
        "preview_truncated": preview_truncated,
    }


def _build_file_snapshot(
    *,
    repo_root: Path,
    worktree_path: Path | None,
    candidate: dict[str, Any],
    max_preview_lines: int,
    max_preview_chars: int,
) -> dict[str, Any]:
    file_path = _normalize_path(candidate.get("file_path"))
    resolved = _resolve_snapshot_path(repo_root=repo_root, worktree_path=worktree_path, file_path=file_path)
    preview = _read_preview(resolved, max_lines=max_preview_lines, max_chars=max_preview_chars)
    return {
        "file_path": file_path,
        "workspace_file_path": str(resolved) if resolved is not None else None,
        "exists": preview["exists"],
        "line_count": preview["line_count"],
        "size_bytes": preview["size_bytes"],
        "preview": preview["preview"],
        "preview_truncated": preview["preview_truncated"],
        "action": candidate.get("action") or "inspect_then_patch",
        "rationale": candidate.get("rationale") or "Inspect and patch minimally.",
    }


def _build_code_patch_markdown(result: dict[str, Any]) -> str:
    lines = [
        f"# Code patch synthesis bundle for {result['proposal_id']}",
        "",
        "## Workspace",
        f"- repo_root: {result.get('repo_root') or '-'}",
        f"- worktree_path: {result.get('worktree_path') or '-'}",
        f"- branch_name: {result.get('branch_name') or '-'}",
        f"- promotion_status: {result.get('promotion_status') or '-'}",
        f"- draft_pr_ref: {result.get('draft_pr_ref') or '-'}",
        "",
        "## Input artifacts",
        f"- patch_request_path: {result.get('patch_request_path') or '-'}",
        f"- patch_request_markdown_path: {result.get('patch_request_markdown_path') or '-'}",
        f"- patch_draft_path: {result.get('patch_draft_path') or '-'}",
        f"- packet_path: {result.get('packet_path') or '-'}",
        "",
        "## Validation commands",
    ]
    for command in result.get("validation_commands") or []:
        lines.append(f"- `{command}`")
    lines.extend([
        "",
        "## File snapshots",
    ])
    for snapshot in result.get("file_snapshots") or []:
        lines.append(f"- {snapshot.get('file_path') or '(choose file after inspection)'}")
        lines.append(f"  workspace_file_path: {snapshot.get('workspace_file_path') or '-'}")
        lines.append(f"  exists: {snapshot.get('exists')}")
        lines.append(f"  line_count: {snapshot.get('line_count')}")
        lines.append(f"  action: {snapshot.get('action')}")
        lines.append(f"  rationale: {snapshot.get('rationale')}")
        preview = snapshot.get("preview")
        if preview:
            lines.append("  preview:")
            for row in str(preview).splitlines():
                lines.append(f"    {row}")
    lines.extend([
        "",
        "## Operator instructions",
    ])
    for item in result.get("operator_instructions") or []:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Stop conditions",
    ])
    for item in result.get("stop_conditions") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def synthesize_code_patch_bundle(
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
    patch_request = synthesize_patch_task(
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
    resolved_repo_root = Path(repo_root).resolve()
    resolved_queue_root = Path(patch_request["queue_root"]).resolve()
    worktree = Path(patch_request["worktree_path"]).resolve() if patch_request.get("worktree_path") else None
    file_snapshots = [
        _build_file_snapshot(
            repo_root=resolved_repo_root,
            worktree_path=worktree,
            candidate=item,
            max_preview_lines=max_preview_lines,
            max_preview_chars=max_preview_chars,
        )
        for item in (patch_request.get("candidate_edits") or [])
    ]
    bundle = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": "ready_for_human_code_patch",
        "repo_root": str(resolved_repo_root),
        "queue_root": str(resolved_queue_root),
        "worktree_path": patch_request.get("worktree_path"),
        "branch_name": patch_request.get("branch_name"),
        "promotion_status": patch_request.get("promotion_status"),
        "draft_pr_ref": patch_request.get("draft_pr_ref"),
        "patch_request_path": patch_request.get("patch_request_path"),
        "patch_request_markdown_path": patch_request.get("patch_request_markdown_path"),
        "patch_draft_path": patch_request.get("patch_draft_path"),
        "packet_path": patch_request.get("packet_path"),
        "validation_commands": patch_request.get("validation_commands") or [],
        "candidate_edits": patch_request.get("candidate_edits") or [],
        "file_snapshots": file_snapshots,
        "operator_instructions": [
            "Open the prepared worktree before editing files.",
            "Edit only the candidate files listed in this bundle unless new evidence forces a narrower write set.",
            "Use apply_patch or minimal file edits and keep the patch reversible.",
            "Run the suggested validation commands before committing or opening a draft PR.",
        ],
        "stop_conditions": [
            "Stop if the worktree no longer matches the promoted proposal evidence.",
            "Stop if candidate edits require widening the allowlist, runtime authority, or tracked sample policy defaults.",
            "Stop if validation fails and the patch scope grows beyond the queued proposal intent.",
        ],
    }
    promotions_root = resolved_queue_root / "promotions"
    bundle_json_path = promotions_root / f"{proposal_id}.code_patch_bundle.json"
    bundle_md_path = promotions_root / f"{proposal_id}.code_patch_bundle.md"
    bundle_json_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    bundle_md_path.write_text(_build_code_patch_markdown(bundle), encoding="utf-8")
    bundle["code_patch_bundle_path"] = str(bundle_json_path)
    bundle["code_patch_bundle_markdown_path"] = str(bundle_md_path)
    return bundle


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare a human-reviewed code patch bundle from one queued LINE Desktop patrol proposal.")
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
    result = synthesize_code_patch_bundle(
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
