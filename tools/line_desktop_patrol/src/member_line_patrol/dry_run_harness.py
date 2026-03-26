from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import subprocess
import uuid
from typing import Any

from .macos_adapter import MacOSLineDesktopAdapter
from .policy import PatrolPolicy, load_policy
from .scenario_loader import PatrolScenario, load_scenario
from .trace_store import TraceStore


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_now(value: datetime | None) -> datetime:
    if value is None:
        return _utc_now()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _transition(state: str, status: str, note: str | None = None) -> dict[str, Any]:
    payload = {
        "state": state,
        "status": status,
        "at": _utc_now().isoformat(),
    }
    if note:
        payload["note"] = note
    return payload


def _promote_observation_artifact(
    output_root: str | Path,
    run_id: str,
    source_path: str | None,
    filename: str,
) -> str | None:
    if source_path is None:
        return None
    final_path = Path(output_root) / "runs" / run_id / filename
    final_path.parent.mkdir(parents=True, exist_ok=True)
    Path(source_path).replace(final_path)
    return str(final_path)


def _is_repo_root(candidate: Path) -> bool:
    return (candidate / "package.json").exists() and (candidate / "tools" / "line_desktop_patrol" / "read_repo_runtime_state.js").exists()


def _resolve_repo_root() -> Path:
    cwd = Path.cwd().resolve()
    search_roots = [cwd, *cwd.parents, Path(__file__).resolve(), *Path(__file__).resolve().parents]
    seen: set[Path] = set()
    for candidate in search_roots:
        if candidate in seen:
            continue
        seen.add(candidate)
        if _is_repo_root(candidate):
            return candidate
    return Path(__file__).resolve().parents[4]


def _load_repo_runtime_state(repo_root: Path, route_key: str, runtime_state_path: str | Path | None = None) -> dict[str, Any]:
    if runtime_state_path is not None:
        return json.loads(Path(runtime_state_path).read_text(encoding="utf-8"))
    script = repo_root / "tools" / "line_desktop_patrol" / "read_repo_runtime_state.js"
    completed = subprocess.run(
        ["node", str(script)],
        cwd=str(repo_root),
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or "runtime state read failed")
    return json.loads(completed.stdout)


def _resolve_target(policy: PatrolPolicy, target_alias: str | None) -> Any:
    if target_alias is None:
        return policy.allowed_targets[0]
    for target in policy.allowed_targets:
        if target.alias == target_alias:
            return target
    raise ValueError(f"unknown target alias: {target_alias}")


def run_dry_run_harness(
    *,
    policy_path: str | Path,
    scenario_path: str | Path,
    output_root: str | Path,
    route_key: str,
    target_alias: str | None = None,
    allow_disabled_policy: bool = False,
    current_time: datetime | None = None,
    runtime_state_path: str | Path | None = None,
) -> dict[str, Any]:
    started_at = _resolve_now(current_time)
    state_transitions = [_transition("LOAD_POLICY", "started")]
    policy = load_policy(policy_path)
    state_transitions.append(_transition("LOAD_POLICY", "completed"))

    state_transitions.append(_transition("LOAD_SCENARIO", "started"))
    scenario = load_scenario(scenario_path)
    state_transitions.append(_transition("LOAD_SCENARIO", "completed"))

    if not policy.enabled and not allow_disabled_policy:
        raise ValueError("policy disabled; pass --allow-disabled-policy for local dry-run validation")

    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "started"))
    repo_root = _resolve_repo_root()
    runtime_state = _load_repo_runtime_state(repo_root, route_key, runtime_state_path)
    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "completed"))

    state_transitions.append(_transition("PROBE_HOST", "started"))
    adapter = MacOSLineDesktopAdapter()
    host_probe = adapter.probe_host()
    state_transitions.append(_transition("PROBE_HOST", "completed"))

    state_transitions.append(_transition("PRECHECK", "started"))
    target = _resolve_target(policy, target_alias)
    if "dry_run" not in target.allowed_send_modes:
        raise ValueError(f"target {target.alias} does not allow dry_run mode")
    planned_prepare = adapter.plan_prepare_line_app(target.alias)
    planned_screenshot = adapter.plan_capture_screenshot(
        Path(output_root) / "runs" / "planned" / "planned_after.png"
    )
    planned_ax_dump = adapter.plan_dump_ax_tree(
        Path(output_root) / "runs" / "planned" / "planned_after.ax.json"
    )
    planned_visible_output_path = Path(output_root) / "runs" / "planned" / "planned_after.visible.json"
    if hasattr(adapter, "plan_read_visible_messages"):
        planned_visible_messages = adapter.plan_read_visible_messages(planned_visible_output_path)
    else:
        planned_visible_messages = {
            "status": "planned",
            "reason": "visible_message_observation_not_supported",
            "output_path": str(planned_visible_output_path),
        }
    state_transitions.append(_transition("PRECHECK", "completed"))

    state_transitions.append(_transition("OPEN_TARGET", "planned", "bounded LINE open/focus plan only"))
    state_transitions.append(_transition("SEND_OR_DRYRUN", "skipped", "dry_run_only_skip"))
    visible_after = []
    screenshot_after = None
    ax_tree_after = None
    screenshot_capture = {
        "status": "skipped",
        "reason": "store_screenshots_disabled",
        "plan": planned_screenshot,
    }
    ax_dump = {
        "status": "skipped",
        "reason": "store_ax_tree_disabled",
        "plan": planned_ax_dump,
    }
    visible_read = {
        "status": "skipped",
        "reason": "store_ax_tree_disabled",
        "plan": planned_visible_messages,
    }
    screenshot_completed = False
    ax_completed = False
    observation_status = "opt_in_observation_disabled_pr9"
    if policy.store_screenshots:
        state_transitions.append(_transition("OBSERVE", "started", "capture_screenshot_if_macos"))
        screenshot_output_path = Path(output_root) / "runs" / "pending" / "after.png"
        screenshot_capture = adapter.execute_capture_screenshot(screenshot_output_path)
        if screenshot_capture.get("status") == "executed" and screenshot_capture.get("result", {}).get("status") == "ok" and screenshot_capture.get("file_exists"):
            screenshot_after = str(Path(screenshot_capture["output_path"]))
            screenshot_completed = True
            state_transitions.append(_transition("OBSERVE", "completed", "screenshot_capture_completed_pr7"))
        else:
            reason = screenshot_capture.get("reason") or screenshot_capture.get("result", {}).get("status") or "screenshot_capture_not_completed"
            state_transitions.append(_transition("OBSERVE", "skipped", reason))
    if policy.store_ax_tree:
        state_transitions.append(_transition("OBSERVE", "started", "dump_ax_tree_if_macos"))
        ax_output_path = Path(output_root) / "runs" / "pending" / "after.ax.json"
        ax_dump = adapter.execute_dump_ax_tree(ax_output_path)
        if ax_dump.get("status") == "executed" and ax_dump.get("result", {}).get("status") == "ok" and ax_dump.get("file_exists"):
            ax_tree_after = str(Path(ax_dump["output_path"]))
            ax_completed = True
            state_transitions.append(_transition("OBSERVE", "completed", "ax_dump_completed_pr9"))
        else:
            reason = ax_dump.get("reason") or ax_dump.get("result", {}).get("status") or "ax_dump_not_completed"
            state_transitions.append(_transition("OBSERVE", "skipped", reason))
        state_transitions.append(_transition("OBSERVE", "started", "read_visible_messages_if_macos"))
        visible_output_path = Path(output_root) / "runs" / "pending" / "after.visible.json"
        if hasattr(adapter, "execute_read_visible_messages"):
            visible_read = adapter.execute_read_visible_messages(visible_output_path)
        else:
            visible_read = {
                "status": "skipped",
                "reason": "visible_message_observation_not_supported",
                "plan": planned_visible_messages,
            }
        if visible_read.get("status") == "executed" and visible_read.get("result", {}).get("status") == "ok" and visible_read.get("file_exists"):
            visible_items = visible_read.get("payload_summary", {}).get("items") or []
            visible_after = [
                {
                    "role": str(item.get("role") or "unknown"),
                    "text": str(item.get("text") or "").strip(),
                }
                for item in visible_items
                if str(item.get("text") or "").strip()
            ]
            state_transitions.append(_transition("OBSERVE", "completed", "visible_message_read_completed_pr11"))
        else:
            reason = visible_read.get("reason") or visible_read.get("result", {}).get("status") or "visible_message_read_not_completed"
            state_transitions.append(_transition("OBSERVE", "skipped", reason))
    if not policy.store_screenshots and not policy.store_ax_tree:
        state_transitions.append(_transition("OBSERVE", "skipped", "no_opt_in_observation_enabled"))

    if policy.store_screenshots and not policy.store_ax_tree:
        observation_status = "screenshot_capture_completed_pr7" if screenshot_completed else "screenshot_capture_skipped_pr7"
    elif policy.store_ax_tree and not policy.store_screenshots:
        observation_status = "ax_dump_completed_pr9" if ax_completed else "ax_dump_skipped_pr9"
    elif policy.store_screenshots and policy.store_ax_tree:
        if screenshot_completed and ax_completed:
            observation_status = "screenshot_and_ax_completed_pr9"
        elif screenshot_completed:
            observation_status = "screenshot_completed_ax_not_completed_pr9"
        elif ax_completed:
            observation_status = "screenshot_not_completed_ax_completed_pr9"
        else:
            observation_status = "screenshot_and_ax_not_completed_pr9"

    finished_at = _resolve_now(current_time)
    run_id = f"ldp_{started_at.strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:12]}"
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    trace_store = TraceStore(output_root)
    screenshot_after = _promote_observation_artifact(output_root, run_id, screenshot_after, "after.png")
    if screenshot_after is not None:
        screenshot_capture["output_path"] = screenshot_after
    ax_tree_after = _promote_observation_artifact(output_root, run_id, ax_tree_after, "after.ax.json")
    if ax_tree_after is not None:
        ax_dump["output_path"] = ax_tree_after
    visible_output_path = visible_read.get("output_path")
    promoted_visible_output_path = _promote_observation_artifact(output_root, run_id, visible_output_path, "after.visible.json")
    if promoted_visible_output_path is not None:
        visible_read["output_path"] = promoted_visible_output_path

    trace = {
        "run_id": run_id,
        "scenario_id": scenario.scenario_id,
        "session_id": session_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "git_sha": runtime_state.get("gitSha") or "unknown",
        "app_version": runtime_state.get("serviceMode") or "member",
        "target_id": target.alias,
        "sent_text": scenario.user_input,
        "visible_before": [],
        "visible_after": visible_after,
        "screenshot_before": None,
        "screenshot_after": screenshot_after,
        "ax_tree_before": None,
        "ax_tree_after": ax_tree_after,
        "model_config": {
            "dry_run": True,
            "route_key": route_key,
            "allow_disabled_policy_override": allow_disabled_policy,
        },
        "retrieval_refs": [],
        "evaluator_scores": {
            "status": "not_run",
            "reason": "evaluation_bridge_not_implemented_in_pr2",
        },
        "failure_reason": "dry_run_only_skip",
        "proposal_id": None,
        "dry_run_applied": True,
        "policy_enabled": policy.enabled,
        "host_probe": host_probe,
        "runtime_state": runtime_state,
        "planned_actions": {
            "prepare_line_app": planned_prepare,
            "capture_screenshot": planned_screenshot,
            "dump_ax_tree": planned_ax_dump,
            "read_visible_messages": planned_visible_messages,
        },
        "observation_artifacts": {
            "capture_screenshot": screenshot_capture,
            "dump_ax_tree": ax_dump,
            "read_visible_messages": visible_read,
        },
        "scenario_expectations": {
            "expected_behavior": list(scenario.expected_behavior),
            "expected_routing": list(scenario.expected_routing),
            "forbidden_patterns": list(scenario.forbidden_patterns),
        },
        "state_transitions": state_transitions,
        "observation_status": observation_status,
    }
    trace_path = trace_store.write_trace(trace)
    state_transitions.append(_transition("UPDATE_STATE", "completed"))
    trace_store.write_json_artifact(run_id, "summary.json", {
        "ok": True,
        "run_id": run_id,
        "trace_path": str(trace_path),
        "failure_reason": trace["failure_reason"],
        "dry_run_applied": True,
        "target_id": target.alias,
    })
    return {
        "ok": True,
        "run_id": run_id,
        "tracePath": str(trace_path),
        "targetId": target.alias,
        "failureReason": trace["failure_reason"],
        "hostProbe": host_probe,
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a local-only dry-run scenario and persist a patrol trace artifact.")
    parser.add_argument("--policy", required=True, help="Path to the patrol policy JSON file.")
    parser.add_argument("--scenario", required=True, help="Path to the scenario JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where local artifacts should be written.")
    parser.add_argument("--route-key", default="line-desktop-patrol", help="Route key for runtime state reads.")
    parser.add_argument("--target-alias", default=None, help="Optional allowlist alias override.")
    parser.add_argument("--allow-disabled-policy", action="store_true", help="Allow local dry-run validation even if policy.enabled=false.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_dry_run_harness(
        policy_path=args.policy,
        scenario_path=args.scenario,
        output_root=args.output_root,
        route_key=args.route_key,
        target_alias=args.target_alias,
        allow_disabled_policy=args.allow_disabled_policy,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
