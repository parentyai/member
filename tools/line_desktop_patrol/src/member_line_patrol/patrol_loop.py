from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import argparse
import json
import uuid
from typing import Any

from .dry_run_harness import _load_repo_runtime_state, _resolve_repo_root, _resolve_target, _transition, run_dry_run_harness
from .loop_state import load_loop_state, update_loop_state
from .macos_adapter import MacOSLineDesktopAdapter
from .policy import BlockedHoursWindow, PatrolPolicy, load_policy
from .scenario_loader import load_scenario
from .trace_store import TraceStore


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_now(value: str | None) -> datetime:
    if not value:
        return _utc_now()
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _runtime_kill_switch_enabled(runtime_state: dict[str, Any]) -> bool:
    global_state = runtime_state.get("global") if isinstance(runtime_state.get("global"), dict) else {}
    public_write = global_state.get("publicWriteSafety") if isinstance(global_state.get("publicWriteSafety"), dict) else {}
    return bool(global_state.get("killSwitch")) or bool(public_write.get("killSwitchOn"))


def _resolve_blocked_window(policy: PatrolPolicy, now: datetime) -> BlockedHoursWindow | None:
    day_map = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
    for window in policy.blocked_hours:
        localized = now.astimezone(ZoneInfo(window.timezone))
        day = day_map[localized.weekday()]
        if day not in window.days:
            continue
        if window.start_hour <= localized.hour < window.end_hour:
            return window
    return None


def _write_latest_summary(path_value: str | Path, payload: dict[str, Any]) -> str:
    output_path = Path(path_value).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(output_path)


def _build_guard_trace(
    *,
    run_id: str,
    session_id: str,
    started_at: datetime,
    finished_at: datetime,
    policy: PatrolPolicy,
    scenario: Any,
    target: Any,
    route_key: str,
    runtime_state: dict[str, Any],
    host_probe: dict[str, Any],
    planned_prepare: dict[str, Any],
    output_root: str | Path,
    decision: str,
    observation_status: str,
    state_transitions: list[dict[str, Any]],
    note: str | None = None,
) -> dict[str, Any]:
    adapter = MacOSLineDesktopAdapter()
    return {
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
        "visible_after": [],
        "screenshot_before": None,
        "screenshot_after": None,
        "ax_tree_before": None,
        "ax_tree_after": None,
        "model_config": {
            "dry_run": True,
            "route_key": route_key,
            "guard_enforced_loop": True,
            "policy_enabled": policy.enabled,
        },
        "retrieval_refs": [],
        "evaluator_scores": {
            "status": "not_run",
            "reason": decision,
        },
        "failure_reason": decision,
        "proposal_id": None,
        "dry_run_applied": True,
        "policy_enabled": policy.enabled,
        "host_probe": host_probe,
        "runtime_state": runtime_state,
        "planned_actions": {
            "prepare_line_app": planned_prepare,
            "capture_screenshot": adapter.plan_capture_screenshot(
                Path(output_root) / "runs" / run_id / "planned_after.png"
            ),
        },
        "scenario_expectations": {
            "expected_behavior": list(scenario.expected_behavior),
            "expected_routing": list(scenario.expected_routing),
            "forbidden_patterns": list(scenario.forbidden_patterns),
        },
        "state_transitions": state_transitions,
        "observation_status": observation_status,
        "guard_note": note,
    }


def run_patrol_loop(
    *,
    policy_path: str | Path,
    scenario_path: str | Path,
    output_root: str | Path,
    route_key: str,
    target_alias: str | None = None,
    allow_disabled_policy: bool = False,
    now_iso: str | None = None,
    runtime_state_path: str | Path | None = None,
    latest_summary_path: str | Path | None = None,
) -> dict[str, Any]:
    started_at = _resolve_now(now_iso)
    finished_at = started_at
    state_transitions = [_transition("LOAD_POLICY", "started")]
    policy = load_policy(policy_path)
    state_transitions.append(_transition("LOAD_POLICY", "completed"))

    state_transitions.append(_transition("LOAD_SCENARIO", "started"))
    scenario = load_scenario(scenario_path)
    state_transitions.append(_transition("LOAD_SCENARIO", "completed"))

    repo_root = _resolve_repo_root()
    latest_summary_output = Path(latest_summary_path).resolve() if latest_summary_path else repo_root / "tmp" / "line_desktop_patrol_latest.json"
    output_root_resolved = Path(output_root).resolve()

    state_transitions.append(_transition("LOAD_LOCAL_STATE", "started"))
    current_state = load_loop_state(output_root_resolved)
    state_transitions.append(_transition("LOAD_LOCAL_STATE", "completed"))

    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "started"))
    runtime_state = _load_repo_runtime_state(repo_root, route_key, runtime_state_path)
    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "completed"))

    state_transitions.append(_transition("PROBE_HOST", "started"))
    adapter = MacOSLineDesktopAdapter()
    host_probe = adapter.probe_host()
    state_transitions.append(_transition("PROBE_HOST", "completed"))

    state_transitions.append(_transition("PRECHECK", "started"))
    target = _resolve_target(policy, target_alias)
    planned_prepare = adapter.plan_prepare_line_app(target.alias)

    counted_runs_last_hour = current_state.counted_runs_last_hour(started_at)
    blocked_window = _resolve_blocked_window(policy, started_at)

    decision = None
    note = None
    counted_towards_hourly_cap = False
    observation_status = "planned_only_pr2"
    allowed = False

    if not policy.enabled and not allow_disabled_policy:
      decision = "policy_disabled_stop"
      note = "local policy disabled"
      observation_status = "guard_stopped_pr6"
      state_transitions.append(_transition("POLICY_DISABLED_STOP", "completed", note))
    elif _runtime_kill_switch_enabled(runtime_state):
      decision = "kill_switch_stop"
      note = "repo-side global kill switch is enabled"
      observation_status = "guard_stopped_pr6"
      state_transitions.append(_transition("KILL_SWITCH_STOP", "completed", note))
    elif current_state.failure_streak >= policy.failure_streak_threshold:
      decision = "failure_streak_stop"
      note = f"failure_streak={current_state.failure_streak}"
      observation_status = "guard_stopped_pr6"
      state_transitions.append(_transition("FAILURE_STREAK_STOP", "completed", note))
    elif blocked_window is not None:
      decision = "blocked_hours_skip"
      note = blocked_window.label or blocked_window.timezone
      observation_status = "guard_stopped_pr6"
      state_transitions.append(_transition("BLOCKED_HOURS_SKIP", "completed", note))
    elif counted_runs_last_hour >= policy.max_runs_per_hour:
      decision = "max_runs_per_hour_skip"
      note = f"counted_runs_last_hour={counted_runs_last_hour}"
      observation_status = "guard_stopped_pr6"
      state_transitions.append(_transition("MAX_RUNS_PER_HOUR_SKIP", "completed", note))
    else:
      allowed = True
      counted_towards_hourly_cap = True
      state_transitions.append(_transition("PRECHECK", "completed"))

    if allowed:
      result = run_dry_run_harness(
          policy_path=policy_path,
          scenario_path=scenario_path,
          output_root=output_root_resolved,
          route_key=route_key,
          target_alias=target.alias,
          allow_disabled_policy=allow_disabled_policy,
          current_time=started_at,
          runtime_state_path=runtime_state_path,
      )
      trace_path = Path(result["tracePath"]).resolve()
      trace = json.loads(trace_path.read_text(encoding="utf-8"))
      finished_at = _resolve_now(trace.get("finished_at"))
      decision = trace.get("failure_reason") or "completed"
      state_update = update_loop_state(
          output_root_resolved,
          now=finished_at,
          run_id=trace["run_id"],
          started_at=trace["started_at"],
          finished_at=trace["finished_at"],
          decision=decision,
          target_id=target.alias,
          counted_towards_hourly_cap=counted_towards_hourly_cap,
          allowed=True,
          note="dry_run_harness_completed",
      )
      latest_summary = {
          "ok": True,
          "generated_at": finished_at.isoformat(),
          "decision": decision,
          "allowed": True,
          "trace_path": str(trace_path),
          "state_path": state_update["state_path"],
          "run_id": trace["run_id"],
          "target_id": target.alias,
          "counted_runs_last_hour": counted_runs_last_hour + 1,
          "failure_streak": state_update["state"]["failure_streak"],
      }
      latest_summary_written = _write_latest_summary(latest_summary_output, latest_summary)
      return {
          "ok": True,
          "allowed": True,
          "decision": decision,
          "runId": trace["run_id"],
          "tracePath": str(trace_path),
          "statePath": state_update["state_path"],
          "latestSummaryPath": latest_summary_written,
          "targetId": target.alias,
          "countedRunsLastHour": counted_runs_last_hour + 1,
          "failureStreak": state_update["state"]["failure_streak"],
      }

    finished_at = started_at
    run_id = f"ldp_{started_at.strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:12]}"
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    trace_store = TraceStore(output_root_resolved)
    trace = _build_guard_trace(
        run_id=run_id,
        session_id=session_id,
        started_at=started_at,
        finished_at=finished_at,
        policy=policy,
        scenario=scenario,
        target=target,
        route_key=route_key,
        runtime_state=runtime_state,
        host_probe=host_probe,
        planned_prepare=planned_prepare,
        output_root=output_root_resolved,
        decision=decision or "guard_stopped",
        observation_status=observation_status,
        state_transitions=state_transitions,
        note=note,
    )
    trace_path = trace_store.write_trace(trace)
    trace_store.write_json_artifact(run_id, "summary.json", {
        "ok": True,
        "run_id": run_id,
        "trace_path": str(trace_path),
        "failure_reason": trace["failure_reason"],
        "dry_run_applied": True,
        "target_id": target.alias,
        "allowed": False,
    })
    state_update = update_loop_state(
        output_root_resolved,
        now=finished_at,
        run_id=run_id,
        started_at=trace["started_at"],
        finished_at=trace["finished_at"],
        decision=trace["failure_reason"],
        target_id=target.alias,
        counted_towards_hourly_cap=False,
        allowed=False,
        note=note,
    )
    latest_summary = {
        "ok": True,
        "generated_at": finished_at.isoformat(),
        "decision": trace["failure_reason"],
        "allowed": False,
        "trace_path": str(trace_path),
        "state_path": state_update["state_path"],
        "run_id": run_id,
        "target_id": target.alias,
        "counted_runs_last_hour": counted_runs_last_hour,
        "failure_streak": state_update["state"]["failure_streak"],
        "note": note,
    }
    latest_summary_written = _write_latest_summary(latest_summary_output, latest_summary)
    return {
        "ok": True,
        "allowed": False,
        "decision": trace["failure_reason"],
        "runId": run_id,
        "tracePath": str(trace_path),
        "statePath": state_update["state_path"],
        "latestSummaryPath": latest_summary_written,
        "targetId": target.alias,
        "countedRunsLastHour": counted_runs_last_hour,
        "failureStreak": state_update["state"]["failure_streak"],
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the guard-enforced local desktop patrol loop without enabling any desktop send path.")
    parser.add_argument("--policy", required=True, help="Path to the patrol policy JSON file.")
    parser.add_argument("--scenario", required=True, help="Path to the scenario JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where local artifacts should be written.")
    parser.add_argument("--route-key", default="line-desktop-patrol", help="Route key for runtime state reads.")
    parser.add_argument("--target-alias", default=None, help="Optional allowlist alias override.")
    parser.add_argument("--allow-disabled-policy", action="store_true", help="Allow local loop validation even if policy.enabled=false.")
    parser.add_argument("--now", default=None, help="Optional ISO8601 time override for deterministic local validation.")
    parser.add_argument("--runtime-state-path", default=None, help="Optional runtime state JSON fixture path.")
    parser.add_argument("--latest-summary-path", default=None, help="Optional path override for tmp/line_desktop_patrol_latest.json.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_patrol_loop(
        policy_path=args.policy,
        scenario_path=args.scenario,
        output_root=args.output_root,
        route_key=args.route_key,
        target_alias=args.target_alias,
        allow_disabled_policy=args.allow_disabled_policy,
        now_iso=args.now,
        runtime_state_path=args.runtime_state_path,
        latest_summary_path=args.latest_summary_path,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
