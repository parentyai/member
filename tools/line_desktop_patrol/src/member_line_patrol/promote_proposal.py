from __future__ import annotations

from pathlib import Path
import argparse
import json
import subprocess
import tempfile
from typing import Any, Callable

from .proposal_builder import read_json_file
from .proposal_queue import ProposalQueue


def _safe_branch_name(proposal_id: str) -> str:
    normalized = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in proposal_id.strip().lower())
    normalized = normalized.strip("-_") or "proposal"
    return f"codex/line-desktop-patrol-{normalized[:48]}"


def _read_packet(queue_root: Path, proposal_id: str) -> tuple[dict[str, Any], Path]:
    packet_path = queue_root / "packets" / f"{proposal_id}.codex.json"
    if not packet_path.exists():
        raise FileNotFoundError(f"missing packet for proposal_id={proposal_id}")
    return read_json_file(packet_path), packet_path


def _read_queue_entry(queue_root: Path, proposal_id: str) -> dict[str, Any]:
    queue = ProposalQueue(queue_root / "queue.jsonl")
    for entry in queue.list_entries():
        if isinstance(entry, dict) and str(entry.get("proposal_id")) == proposal_id:
            return entry
    raise ValueError(f"proposal_id not found in queue: {proposal_id}")


def _build_draft_pr_title(packet: dict[str, Any], proposal_id: str) -> str:
    proposal = packet.get("proposal") if isinstance(packet.get("proposal"), dict) else {}
    title = str(proposal.get("title") or "").strip()
    return title or f"LINE Desktop Patrol proposal: {proposal_id}"


def _build_draft_pr_body(packet: dict[str, Any], queue_entry: dict[str, Any]) -> str:
    proposal = packet.get("proposal") if isinstance(packet.get("proposal"), dict) else {}
    trace_ref = packet.get("trace_ref") if isinstance(packet.get("trace_ref"), dict) else {}
    evaluation_ref = packet.get("evaluation_ref") if isinstance(packet.get("evaluation_ref"), dict) else {}
    return "\n".join([
        f"# { _build_draft_pr_title(packet, queue_entry['proposal_id']) }",
        "",
        "## Why now",
        str(proposal.get("why_now") or "Execute patrol proposal promoted for review."),
        "",
        "## Why not others",
        str(proposal.get("why_not_others") or "This is the smallest change scope supported by the current evidence."),
        "",
        "## Source trace",
        f"- run_id: {trace_ref.get('run_id') or '-'}",
        f"- trace_path: {trace_ref.get('trace_path') or '-'}",
        f"- scenario_id: {trace_ref.get('scenario_id') or '-'}",
        f"- target_id: {trace_ref.get('target_id') or '-'}",
        f"- failure_reason: {trace_ref.get('failure_reason') or '-'}",
        "",
        "## Evaluation summary",
        f"- planning_status: {evaluation_ref.get('planning_status') or '-'}",
        f"- analysis_status: {evaluation_ref.get('analysis_status') or '-'}",
        f"- observation_status: {evaluation_ref.get('observation_status') or '-'}",
        f"- expected_score_delta: {queue_entry.get('expected_score_delta')}",
        "",
        "## Affected files",
        *[f"- {item}" for item in (queue_entry.get("affected_files") or [])],
        "",
        "## Rollback note",
        "- Revert the draft PR branch or discard the worktree if no code changes are applied.",
    ])


def _build_patch_draft(packet: dict[str, Any], queue_entry: dict[str, Any]) -> str:
    proposal = packet.get("proposal") if isinstance(packet.get("proposal"), dict) else {}
    trace_ref = packet.get("trace_ref") if isinstance(packet.get("trace_ref"), dict) else {}
    evaluation_ref = packet.get("evaluation_ref") if isinstance(packet.get("evaluation_ref"), dict) else {}
    target_files = queue_entry.get("affected_files") or []
    expected_impact = proposal.get("expected_impact") if isinstance(proposal.get("expected_impact"), list) else []
    rollback_plan = proposal.get("rollback_plan") if isinstance(proposal.get("rollback_plan"), list) else []
    root_cause_refs = proposal.get("root_cause_refs") if isinstance(proposal.get("root_cause_refs"), list) else []
    return "\n".join([
        f"# Patch draft for {queue_entry['proposal_id']}",
        "",
        "## Intent",
        f"- title: {_build_draft_pr_title(packet, queue_entry['proposal_id'])}",
        f"- change_scope: {queue_entry.get('proposed_change_scope') or '-'}",
        f"- risk_level: {queue_entry.get('risk_level') or '-'}",
        f"- expected_score_delta: {queue_entry.get('expected_score_delta')}",
        "",
        "## Source evidence",
        f"- run_id: {trace_ref.get('run_id') or '-'}",
        f"- trace_path: {trace_ref.get('trace_path') or '-'}",
        f"- scenario_id: {trace_ref.get('scenario_id') or '-'}",
        f"- planning_status: {evaluation_ref.get('planning_status') or '-'}",
        f"- observation_status: {evaluation_ref.get('observation_status') or '-'}",
        "",
        "## Why now",
        str(proposal.get("why_now") or "Promoted from execute patrol evidence."),
        "",
        "## Why not others",
        str(proposal.get("why_not_others") or "Keep the patch limited to the smallest reviewable scope supported by the evidence."),
        "",
        "## Root cause refs",
        *([f"- {item}" for item in root_cause_refs] or ["- none"]),
        "",
        "## Affected files",
        *([f"- {item}" for item in target_files] or ["- inspect the linked proposal packet and trace before selecting files"]),
        "",
        "## Expected impact",
        *([f"- {item}" for item in expected_impact] or ["- improve the score delta predicted in the proposal queue entry"]),
        "",
        "## Draft patch checklist",
        "- Reproduce the issue from the linked trace and evaluation artifacts.",
        "- Keep edits add-only or minimally invasive.",
        "- Update tests that prove the guarded behavior still fails closed on wrong targets.",
        "- Refresh docs or runbooks if the chosen patch changes operator-visible behavior.",
        "- Do not auto-apply runtime or routing changes without human review.",
        "",
        "## Rollback note",
        *([f"- {item}" for item in rollback_plan] or ["- Revert the draft branch or discard the patch draft if evidence changes."]),
    ])


def _default_runner(argv: list[str], *, cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, cwd=cwd, check=False, capture_output=True, text=True)


def _ensure_worktree(
    *,
    repo_root: Path,
    worktree_path: Path,
    branch_name: str,
    base_ref: str,
    runner: Callable[..., Any],
) -> dict[str, Any]:
    if worktree_path.exists() and (worktree_path / ".git").exists():
        return {"status": "existing", "worktree_path": str(worktree_path), "branch_name": branch_name}
    worktree_path.parent.mkdir(parents=True, exist_ok=True)
    completed = runner(
        ["git", "-C", str(repo_root), "worktree", "add", str(worktree_path), "-b", branch_name, base_ref],
        cwd=str(repo_root),
    )
    return {
        "status": "created" if completed.returncode == 0 else "failed",
        "worktree_path": str(worktree_path),
        "branch_name": branch_name,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip() or None,
        "stderr": completed.stderr.strip() or None,
    }


def _has_branch_diff(
    *,
    worktree_path: Path,
    base_ref: str,
    runner: Callable[..., Any],
) -> bool:
    completed = runner(
        ["git", "-C", str(worktree_path), "rev-list", "--left-right", "--count", f"{base_ref}...HEAD"],
        cwd=str(worktree_path),
    )
    if completed.returncode != 0:
        return False
    parts = (completed.stdout.strip().split() + ["0", "0"])[:2]
    ahead = int(parts[1] or "0")
    status = runner(["git", "-C", str(worktree_path), "status", "--porcelain"], cwd=str(worktree_path))
    return ahead > 0 or bool(status.stdout.strip())


def promote_proposal(
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
    resolved_queue_root = Path(queue_root).resolve()
    resolved_repo_root = Path(repo_root).resolve()
    queue_entry = _read_queue_entry(resolved_queue_root, proposal_id)
    packet, packet_path = _read_packet(resolved_queue_root, proposal_id)

    branch = branch_name or _safe_branch_name(proposal_id)
    worktree = Path(worktree_path).resolve() if worktree_path else Path(tempfile.gettempdir()) / f"member-line-desktop-{proposal_id}"
    promotions_root = resolved_queue_root / "promotions"
    promotions_root.mkdir(parents=True, exist_ok=True)
    body_path = promotions_root / f"{proposal_id}.draft_pr.md"
    body_path.write_text(_build_draft_pr_body(packet, queue_entry), encoding="utf-8")
    patch_draft_path = promotions_root / f"{proposal_id}.patch_draft.md"
    patch_draft_path.write_text(_build_patch_draft(packet, queue_entry), encoding="utf-8")

    active_runner = runner or _default_runner
    worktree_result = _ensure_worktree(
        repo_root=resolved_repo_root,
        worktree_path=worktree,
        branch_name=branch,
        base_ref=base_ref,
        runner=active_runner,
    )
    risk_level = str(queue_entry.get("risk_level") or "medium").strip().lower()
    has_diff = _has_branch_diff(worktree_path=worktree, base_ref=base_ref, runner=active_runner) if worktree_result.get("status") != "failed" else False

    status = "prepared"
    note = None
    draft_pr_url = None
    draft_pr_ref = None
    if risk_level == "high" and not allow_high_risk_open:
        status = "body_only_high_risk"
        note = "high risk proposals stop at a draft body until a human explicitly allows PR creation"
    elif create_draft_pr and not has_diff:
        status = "prepared_no_branch_diff"
        note = "worktree prepared but branch has no code diff yet"
    elif create_draft_pr:
        push_result = active_runner(
            ["git", "-C", str(worktree), "push", "-u", "origin", branch],
            cwd=str(worktree),
        )
        if push_result.returncode != 0:
            status = "draft_pr_blocked"
            note = push_result.stderr.strip() or push_result.stdout.strip() or "git push failed"
        else:
            pr_result = active_runner(
                [
                    "gh",
                    "pr",
                    "create",
                    "--draft",
                    "--base",
                    base_ref.replace("origin/", ""),
                    "--head",
                    branch,
                    "--title",
                    _build_draft_pr_title(packet, proposal_id),
                    "--body-file",
                    str(body_path),
                ],
                cwd=str(worktree),
            )
            if pr_result.returncode == 0:
                draft_pr_url = pr_result.stdout.strip() or None
                draft_pr_ref = draft_pr_url
                status = "draft_pr_created"
            else:
                status = "draft_pr_blocked"
                note = pr_result.stderr.strip() or pr_result.stdout.strip() or "gh pr create failed"

    record = {
        "ok": True,
        "proposal_id": proposal_id,
        "status": status,
        "queue_root": str(resolved_queue_root),
        "queue_entry": queue_entry,
        "packet_path": str(packet_path),
        "branch_name": branch,
        "base_ref": base_ref,
        "worktree_path": str(worktree),
        "body_path": str(body_path),
        "patch_draft_path": str(patch_draft_path),
        "risk_level": risk_level,
        "create_draft_pr": create_draft_pr,
        "worktree": worktree_result,
        "draft_pr_url": draft_pr_url,
        "draft_pr_ref": draft_pr_ref,
        "has_branch_diff": has_diff,
        "note": note,
    }
    record_path = promotions_root / f"{proposal_id}.json"
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    record["record_path"] = str(record_path)
    return record


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Promote one LINE Desktop patrol proposal into a prepared branch/worktree and optional draft PR.")
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
    result = promote_proposal(
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
