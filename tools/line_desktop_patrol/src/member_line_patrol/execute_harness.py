from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import subprocess
import time
import uuid
from typing import Any, Callable

from .dry_run_harness import _load_repo_runtime_state, _resolve_repo_root, _resolve_target, _transition
from .enqueue_eval_proposals import enqueue_eval_proposals
from .loop_state import load_loop_state, update_loop_state
from .macos_adapter import MacOSLineDesktopAdapter
from .patrol_loop import _resolve_blocked_window, _runtime_kill_switch_enabled
from .policy import load_policy
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


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _write_latest_summary(path_value: str | Path, payload: dict[str, Any]) -> str:
    output_path = Path(path_value).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(output_path)


def _capture_execute_observation(
    *,
    adapter: MacOSLineDesktopAdapter,
    output_root: str | Path,
    run_id: str,
    phase: str,
    target: Any,
) -> dict[str, Any]:
    run_root = Path(output_root).resolve() / "runs" / run_id
    screenshot = adapter.execute_capture_screenshot(run_root / f"{phase}.png")
    validation = adapter.execute_validate_target(
        expected_chat_title=target.expected_chat_title,
        expected_window_title_substring=target.expected_window_title_substring,
        expected_participant_labels=target.expected_participant_labels,
        expected_ax_fingerprint=target.expected_ax_fingerprint,
        require_confirmation=False,
        ax_output_path=run_root / f"{phase}.ax.json",
        visible_output_path=run_root / f"{phase}.visible.json",
    )
    return {
        "phase": phase,
        "capture_screenshot": screenshot,
        "validate_target": validation,
    }


def _extract_visible_rows(observation: dict[str, Any]) -> list[dict[str, str]]:
    validation = observation.get("validate_target") if isinstance(observation, dict) else {}
    visible_read = validation.get("visible_read") if isinstance(validation, dict) else {}
    payload = visible_read.get("payload_summary") if isinstance(visible_read, dict) else {}
    rows = payload.get("items") if isinstance(payload, dict) else []
    output = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        text = _normalize_text(row.get("text"))
        if not text:
            continue
        output.append({
            "role": _normalize_text(row.get("role")) or "unknown",
            "text": text,
        })
    return output


def _observation_path(observation: dict[str, Any], key: str) -> str | None:
    if not isinstance(observation, dict):
        return None
    if key == "screenshot":
        payload = observation.get("capture_screenshot")
        if isinstance(payload, dict):
            return _normalize_text(payload.get("output_path"))
        return None
    validation = observation.get("validate_target")
    if not isinstance(validation, dict):
        return None
    if key == "ax":
        ax_dump = validation.get("ax_dump")
        return _normalize_text(ax_dump.get("output_path")) if isinstance(ax_dump, dict) else None
    if key == "visible":
        visible_read = validation.get("visible_read")
        return _normalize_text(visible_read.get("output_path")) if isinstance(visible_read, dict) else None
    return None


def _correlate_visible(before_rows: list[dict[str, str]], after_rows: list[dict[str, str]], sent_text: str) -> dict[str, Any]:
    before_texts = [str(item.get("text") or "") for item in before_rows]
    after_texts = [str(item.get("text") or "") for item in after_rows]
    sent = _normalize_text(sent_text) or ""
    user_echo_confirmed = sent in after_texts and sent not in before_texts
    new_rows = [row for row in after_rows if row.get("text") not in before_texts]
    assistant_candidates = [row for row in new_rows if row.get("text") != sent]
    if not after_rows:
        status = "post_visible_missing"
    elif user_echo_confirmed and assistant_candidates:
        status = "reply_observed"
    elif user_echo_confirmed:
        status = "post_send_reply_missing"
    elif sent in after_texts:
        status = "post_send_reply_ambiguous"
    else:
        status = "send_unconfirmed"
    return {
        "status": status,
        "user_echo_confirmed": user_echo_confirmed,
        "assistant_reply_candidate": assistant_candidates[0] if assistant_candidates else None,
        "new_visible_count": len(new_rows),
    }


def _resolve_guard_decision(
    *,
    policy: Any,
    target: Any,
    runtime_state: dict[str, Any],
    current_state: Any,
    now: datetime,
    explicit_execute: bool,
) -> tuple[str | None, str | None]:
    if not policy.enabled:
        return "policy_disabled_stop", "local policy disabled"
    if _runtime_kill_switch_enabled(runtime_state):
        return "kill_switch_stop", "repo-side global kill switch is enabled"
    if current_state.failure_streak >= policy.failure_streak_threshold:
        return "failure_streak_stop", f"failure_streak={current_state.failure_streak}"
    blocked_window = _resolve_blocked_window(policy, now)
    if blocked_window is not None:
        return "blocked_hours_skip", blocked_window.label or blocked_window.timezone
    if "execute" not in target.allowed_send_modes:
        return "target_execute_not_allowed", target.alias
    if policy.dry_run_default and not explicit_execute:
        return "dry_run_default_stop", "execute requires explicit override"
    return None, None


def _run_evaluator(
    *,
    repo_root: Path,
    trace_path: str | Path,
    main_output_path: str | Path,
    planning_output_path: str | Path,
    runner: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    if runner is not None:
        return runner(
            repo_root=repo_root,
            trace_path=str(Path(trace_path).resolve()),
            main_output_path=str(Path(main_output_path).resolve()),
            planning_output_path=str(Path(planning_output_path).resolve()),
        )
    completed = subprocess.run(
        [
            "node",
            str(repo_root / "tools" / "quality_patrol" / "run_desktop_patrol_eval.js"),
            "--trace",
            str(Path(trace_path).resolve()),
            "--output",
            str(Path(main_output_path).resolve()),
            "--planning-output",
            str(Path(planning_output_path).resolve()),
        ],
        cwd=str(repo_root),
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        return {
            "ok": False,
            "error": completed.stderr.strip() or completed.stdout.strip() or "desktop patrol eval failed",
        }
    return {
        "ok": True,
        "stdout": completed.stdout.strip() or None,
        "mainOutputPath": str(Path(main_output_path).resolve()),
        "planningOutputPath": str(Path(planning_output_path).resolve()),
    }


def _load_json_if_exists(path_value: str | Path | None) -> dict[str, Any] | None:
    if not path_value:
        return None
    path_obj = Path(path_value).resolve()
    if not path_obj.exists():
        return None
    return json.loads(path_obj.read_text(encoding="utf-8"))


def _derive_evaluator_scores(main_artifact: dict[str, Any] | None, decision: str | None) -> dict[str, Any]:
    if not isinstance(main_artifact, dict):
        return {"status": "not_run", "reason": decision}
    summary = main_artifact.get("summary") if isinstance(main_artifact.get("summary"), dict) else {}
    return {
        "status": "completed",
        "overallStatus": _normalize_text(summary.get("overallStatus")) or _normalize_text(main_artifact.get("status")) or "unknown",
        "planningStatus": _normalize_text(main_artifact.get("planningStatus")) or "unknown",
        "analysisStatus": _normalize_text(main_artifact.get("analysisStatus")) or "unknown",
        "observationStatus": _normalize_text(main_artifact.get("observationStatus")) or "unknown",
        "reviewUnitCount": main_artifact.get("reviewUnitCount"),
        "topPriorityCount": main_artifact.get("topPriorityCount"),
    }


def run_execute_harness(
    *,
    policy_path: str | Path,
    scenario_path: str | Path,
    output_root: str | Path,
    route_key: str,
    mode: str = "execute_once",
    target_alias: str | None = None,
    runtime_state_path: str | Path | None = None,
    latest_summary_path: str | Path | None = None,
    now_iso: str | None = None,
    reply_wait_window_ms: int = 1500,
    message_text: str | None = None,
    adapter_factory: Callable[[], MacOSLineDesktopAdapter] | None = None,
    evaluate_runner: Callable[..., dict[str, Any]] | None = None,
    enqueue_runner: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    started_at = _resolve_now(now_iso)
    state_transitions = [_transition("LOAD_POLICY", "started")]
    policy = load_policy(policy_path)
    state_transitions.append(_transition("LOAD_POLICY", "completed"))

    state_transitions.append(_transition("LOAD_SCENARIO", "started"))
    scenario = load_scenario(scenario_path)
    state_transitions.append(_transition("LOAD_SCENARIO", "completed"))

    repo_root = _resolve_repo_root()
    output_root_resolved = Path(output_root).resolve()
    latest_summary_output = Path(latest_summary_path).resolve() if latest_summary_path else repo_root / "tmp" / "line_desktop_patrol_latest.json"

    state_transitions.append(_transition("LOAD_LOCAL_STATE", "started"))
    current_state = load_loop_state(output_root_resolved)
    state_transitions.append(_transition("LOAD_LOCAL_STATE", "completed"))

    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "started"))
    runtime_state = _load_repo_runtime_state(repo_root, route_key, runtime_state_path)
    state_transitions.append(_transition("LOAD_RUNTIME_STATE", "completed"))

    adapter = adapter_factory() if adapter_factory else MacOSLineDesktopAdapter()
    state_transitions.append(_transition("PROBE_HOST", "started"))
    host_probe = adapter.probe_host()
    state_transitions.append(_transition("PROBE_HOST", "completed"))

    state_transitions.append(_transition("PRECHECK", "started"))
    target = _resolve_target(policy, target_alias)
    explicit_execute = mode in {"open_target", "send_only", "execute_once"}
    decision, note = _resolve_guard_decision(
        policy=policy,
        target=target,
        runtime_state=runtime_state,
        current_state=current_state,
        now=started_at,
        explicit_execute=explicit_execute,
    )
    if decision is not None:
        state_transitions.append(_transition("PRECHECK", "skipped", decision))
        run_id = f"ldp_{started_at.strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:12]}"
        trace_store = TraceStore(output_root_resolved)
        trace = {
            "run_id": run_id,
            "scenario_id": scenario.scenario_id,
            "session_id": f"session_{uuid.uuid4().hex[:12]}",
            "started_at": started_at.isoformat(),
            "finished_at": started_at.isoformat(),
            "git_sha": runtime_state.get("gitSha") or "unknown",
            "app_version": runtime_state.get("serviceMode") or "member",
            "target_id": target.alias,
            "sent_text": message_text or scenario.user_input,
            "visible_before": [],
            "visible_after": [],
            "screenshot_before": None,
            "screenshot_after": None,
            "ax_tree_before": None,
            "ax_tree_after": None,
            "model_config": {"mode": mode, "explicit_execute": explicit_execute},
            "retrieval_refs": [],
            "evaluator_scores": {"status": "not_run", "reason": decision},
            "failure_reason": decision,
            "proposal_id": None,
            "send_mode": mode,
            "execute_guard_reason": note,
            "runtime_state": runtime_state,
            "host_probe": host_probe,
            "state_transitions": state_transitions,
        }
        trace_path = trace_store.write_trace(trace)
        state_update = update_loop_state(
            output_root_resolved,
            now=started_at,
            run_id=run_id,
            started_at=trace["started_at"],
            finished_at=trace["finished_at"],
            decision=decision,
            target_id=target.alias,
            counted_towards_hourly_cap=False,
            allowed=False,
            note=note,
        )
        latest_summary = {
            "ok": True,
            "mode": mode,
            "generated_at": started_at.isoformat(),
            "decision": decision,
            "allowed": False,
            "trace_path": str(trace_path),
            "state_path": state_update["state_path"],
            "run_id": run_id,
            "target_id": target.alias,
        }
        latest_summary_written = _write_latest_summary(latest_summary_output, latest_summary)
        return {
            "ok": True,
            "allowed": False,
            "decision": decision,
            "tracePath": str(trace_path),
            "statePath": state_update["state_path"],
            "latestSummaryPath": latest_summary_written,
        }
    state_transitions.append(_transition("PRECHECK", "completed"))

    run_id = f"ldp_{started_at.strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:12]}"
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    sent_text = _normalize_text(message_text) or scenario.user_input
    trace_store = TraceStore(output_root_resolved)
    trace_path = trace_store.run_dir(run_id) / "trace.json"

    state_transitions.append(_transition("OPEN_TARGET", "started"))
    open_result = adapter.execute_open_test_chat(
        target_alias=target.alias,
        expected_chat_title=target.expected_chat_title,
        expected_window_title_substring=target.expected_window_title_substring,
        expected_participant_labels=target.expected_participant_labels,
        expected_ax_fingerprint=target.expected_ax_fingerprint,
        require_confirmation=policy.require_target_confirmation,
        ax_output_path=output_root_resolved / "runs" / run_id / "before.ax.json",
        visible_output_path=output_root_resolved / "runs" / run_id / "before.visible.json",
    )
    pre_observation = {
        "capture_screenshot": adapter.execute_capture_screenshot(output_root_resolved / "runs" / run_id / "before.png"),
        "validate_target": open_result.get("validation"),
    }
    if open_result.get("status") != "executed":
        decision = "target_mismatch_stop"
        state_transitions.append(_transition("OPEN_TARGET", "skipped", decision))
    else:
        state_transitions.append(_transition("OPEN_TARGET", "completed", open_result.get("reason")))
        decision = None

    send_result = None
    post_observation = {
        "capture_screenshot": {"status": "skipped", "reason": "send_not_attempted"},
        "validate_target": {
            "status": "skipped",
            "reason": "send_not_attempted",
            "validation": {"matched": False, "reason": "send_not_attempted"},
        },
    }
    correlation = {
        "status": "not_sent",
        "user_echo_confirmed": False,
        "assistant_reply_candidate": None,
        "new_visible_count": 0,
    }
    eval_result = None
    enqueue_result = None

    if decision is None and mode in {"send_only", "execute_once"}:
        state_transitions.append(_transition("SEND", "started"))
        send_result = adapter.execute_send_text(
            sent_text,
            expected_chat_title=target.expected_chat_title,
            expected_window_title_substring=target.expected_window_title_substring,
            expected_participant_labels=target.expected_participant_labels,
            expected_ax_fingerprint=target.expected_ax_fingerprint,
            require_confirmation=policy.require_target_confirmation,
            existing_validation=open_result.get("validation"),
        )
        send_status = (
            send_result.get("result", {}).get("status")
            if isinstance(send_result, dict)
            else None
        )
        if send_status != "sent":
            decision = "send_not_confirmed"
            state_transitions.append(_transition("SEND", "skipped", decision))
        else:
            state_transitions.append(_transition("SEND", "completed", send_result.get("reason")))
            if mode == "send_only":
                decision = "execute_sent"

    if decision is None and mode == "execute_once":
        if reply_wait_window_ms > 0:
            time.sleep(min(max(reply_wait_window_ms, 0), 5000) / 1000)
        state_transitions.append(_transition("POST_OBSERVE", "started"))
        post_observation = _capture_execute_observation(
            adapter=adapter,
            output_root=output_root_resolved,
            run_id=run_id,
            phase="after",
            target=target,
        )
        state_transitions.append(_transition("POST_OBSERVE", "completed"))
        correlation = _correlate_visible(
            _extract_visible_rows(pre_observation),
            _extract_visible_rows(post_observation),
            sent_text,
        )
        if correlation["status"] == "reply_observed":
            decision = "execute_sent"
        elif correlation["status"] == "post_send_reply_missing":
            decision = "post_send_reply_missing"
        elif correlation["status"] == "post_send_reply_ambiguous":
            decision = "post_send_reply_ambiguous"
        else:
            decision = "send_unconfirmed"
    elif decision is None and mode == "open_target":
        decision = "open_target_ready"

    finished_at = _utc_now()
    main_artifact = None
    proposal_id = None

    trace = {
        "run_id": run_id,
        "scenario_id": scenario.scenario_id,
        "session_id": session_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "git_sha": runtime_state.get("gitSha") or "unknown",
        "app_version": runtime_state.get("serviceMode") or "member",
        "target_id": target.alias,
        "sent_text": sent_text,
        "visible_before": _extract_visible_rows(pre_observation),
        "visible_after": _extract_visible_rows(post_observation),
        "screenshot_before": _observation_path(pre_observation, "screenshot"),
        "screenshot_after": _observation_path(post_observation, "screenshot"),
        "ax_tree_before": _observation_path(pre_observation, "ax"),
        "ax_tree_after": _observation_path(post_observation, "ax"),
        "model_config": {
            "mode": mode,
            "explicit_execute": explicit_execute,
            "reply_wait_window_ms": reply_wait_window_ms,
        },
        "retrieval_refs": [],
        "evaluator_scores": {"status": "not_run", "reason": decision},
        "failure_reason": decision,
        "proposal_id": proposal_id,
        "send_mode": mode,
        "target_validation": (
            open_result.get("validation", {}).get("validation")
            if isinstance(open_result, dict) and isinstance(open_result.get("validation"), dict)
            else None
        ),
        "send_result": send_result,
        "pre_observation": pre_observation,
        "post_observation": post_observation,
        "correlation_status": correlation["status"],
        "reply_wait_window_ms": reply_wait_window_ms,
        "runtime_state": runtime_state,
        "host_probe": host_probe,
        "state_transitions": state_transitions,
    }
    if mode == "execute_once" and send_result and send_result.get("result", {}).get("status") == "sent":
        state_transitions.append(_transition("SCORE", "started"))
        eval_root = output_root_resolved / "evals" / run_id
        eval_root.mkdir(parents=True, exist_ok=True)
        main_output_path = eval_root / "desktop_patrol_eval.json"
        planning_output_path = eval_root / "desktop_patrol_eval_planning.json"
        eval_result = _run_evaluator(
            repo_root=repo_root,
            trace_path=trace_path,
            main_output_path=main_output_path,
            planning_output_path=planning_output_path,
            runner=evaluate_runner,
        )
        main_artifact = _load_json_if_exists(
            eval_result.get("mainOutputPath") if isinstance(eval_result, dict) else None
        )
        if eval_result.get("ok"):
            state_transitions.append(_transition("SCORE", "completed", "evaluate_runner"))
            state_transitions.append(_transition("CLASSIFY", "completed"))
            state_transitions.append(_transition("GENERATE_PROPOSAL", "completed"))
        else:
            state_transitions.append(_transition("SCORE", "failed", eval_result.get("error")))
        if eval_result.get("ok") and Path(planning_output_path).exists():
            state_transitions.append(_transition("QUEUE_RESULT", "started"))
            if enqueue_runner is not None:
                enqueue_result = enqueue_runner(
                    trace_path=str(trace_path),
                    planning_output_path=str(planning_output_path),
                    queue_root=str(output_root_resolved / "proposals"),
                    main_output_path=str(main_output_path),
                )
            else:
                enqueue_result = enqueue_eval_proposals(
                    trace_path=trace_path,
                    planning_artifact_path=planning_output_path,
                    queue_root=output_root_resolved / "proposals",
                    main_artifact_path=main_output_path,
                )
            state_transitions.append(_transition("QUEUE_RESULT", "completed"))
            if enqueue_result and enqueue_result.get("queuedCount", 0) > 0:
                decision = "execute_queued"
                proposal_id = enqueue_result.get("queuedProposalIds", [None])[0]
            elif eval_result.get("ok"):
                decision = "execute_evaluated"
                duplicate_ids = enqueue_result.get("duplicateProposalIds", []) if isinstance(enqueue_result, dict) else []
                proposal_id = duplicate_ids[0] if duplicate_ids else None

    trace["evaluator_scores"] = _derive_evaluator_scores(main_artifact, decision)
    trace["failure_reason"] = decision
    trace["proposal_id"] = proposal_id
    trace_path = trace_store.write_trace(trace)
    trace_store.write_json_artifact(run_id, "summary.json", {
        "ok": True,
        "run_id": run_id,
        "mode": mode,
        "decision": decision,
        "send_status": (
            send_result.get("result", {}).get("status")
            if isinstance(send_result, dict) and isinstance(send_result.get("result"), dict)
            else None
        ),
        "correlation_status": correlation["status"],
        "proposal_id": proposal_id,
        "trace_path": str(trace_path),
    })

    counted_towards_hourly_cap = mode in {"send_only", "execute_once"}
    state_update = update_loop_state(
        output_root_resolved,
        now=finished_at,
        run_id=run_id,
        started_at=trace["started_at"],
        finished_at=trace["finished_at"],
        decision=decision,
        target_id=target.alias,
        counted_towards_hourly_cap=counted_towards_hourly_cap,
        allowed=True,
        note=mode,
    )
    latest_summary = {
        "ok": True,
        "mode": mode,
        "generated_at": finished_at.isoformat(),
        "decision": decision,
        "allowed": True,
        "trace_path": str(trace_path),
        "state_path": state_update["state_path"],
        "run_id": run_id,
        "target_id": target.alias,
        "counted_runs_last_hour": current_state.counted_runs_last_hour(finished_at) + (1 if counted_towards_hourly_cap else 0),
        "send_status": (
            send_result.get("result", {}).get("status")
            if isinstance(send_result, dict) and isinstance(send_result.get("result"), dict)
            else None
        ),
        "correlation_status": correlation["status"],
        "proposal_id": proposal_id,
        "eval": eval_result,
        "queue": enqueue_result,
    }
    latest_summary_written = _write_latest_summary(latest_summary_output, latest_summary)
    return {
        "ok": True,
        "allowed": True,
        "decision": decision,
        "tracePath": str(trace_path),
        "statePath": state_update["state_path"],
        "latestSummaryPath": latest_summary_written,
        "eval": eval_result,
        "queue": enqueue_result,
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a bounded LINE Desktop execute harness with policy guards.")
    parser.add_argument("--policy", required=True, help="Path to a local patrol policy JSON file.")
    parser.add_argument("--scenario", required=True, help="Path to the scenario JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where local execute artifacts should be written.")
    parser.add_argument("--route-key", default="line-desktop-patrol", help="Route key for runtime state reads.")
    parser.add_argument("--target-alias", default=None, help="Optional allowlist alias override.")
    parser.add_argument("--runtime-state-path", default=None, help="Optional runtime state fixture path.")
    parser.add_argument("--latest-summary-path", default=None, help="Optional latest summary path override.")
    parser.add_argument("--now", default=None, help="Optional ISO timestamp override for tests.")
    parser.add_argument("--reply-wait-window-ms", type=int, default=1500, help="Milliseconds to wait before post-send observation.")
    parser.add_argument("--message-text", default=None, help="Optional explicit message override.")
    parser.add_argument(
        "--mode",
        choices=("open_target", "send_only", "execute_once"),
        default="execute_once",
        help="Bounded execute mode.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_execute_harness(
        policy_path=args.policy,
        scenario_path=args.scenario,
        output_root=args.output_root,
        route_key=args.route_key,
        mode=args.mode,
        target_alias=args.target_alias,
        runtime_state_path=args.runtime_state_path,
        latest_summary_path=args.latest_summary_path,
        now_iso=args.now,
        reply_wait_window_ms=args.reply_wait_window_ms,
        message_text=args.message_text,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
