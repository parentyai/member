from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
from typing import Any


EXECUTE_MODES = frozenset({"execute_once", "send_only", "open_target"})
REPLY_CORRELATION_USABLE = frozenset({"reply_observed", "post_send_reply_missing"})

DEFAULT_THRESHOLDS = {
    "off_whitelist_send_incidents_max": 0,
    "target_mismatch_false_negative_max": 0,
    "send_success_rate_min": 0.99,
    "observe_success_rate_min": 0.95,
    "reply_correlation_usable_rate_min": 0.80,
    "draft_pr_duplicate_rate_max": 0.0,
    "execute_once_min_runs": 10,
    "scheduled_execute_min_runs": 50,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_send_mode(value: Any) -> str | None:
    text = _normalize_text(value)
    if text is None:
        return None
    lowered = text.lower()
    if lowered == "execute":
        return "execute_once"
    return lowered


def _read_json_if_exists(path_value: str | Path | None) -> dict[str, Any] | None:
    if not path_value:
        return None
    path_obj = Path(path_value).resolve()
    if not path_obj.exists():
        return None
    return json.loads(path_obj.read_text(encoding="utf-8"))


def _unwrap_result_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    nested = payload.get("result")
    if not isinstance(nested, dict):
        nested = {}
    evaluator_scores = nested.get("evaluatorScores")
    if not isinstance(evaluator_scores, dict):
        evaluator_scores = {}
    return {
        "mode": _normalize_send_mode(nested.get("mode") or payload.get("mode")),
        "replyObserved": bool(
            nested.get("replyObserved") is True
            or payload.get("replyObserved") is True
            or evaluator_scores.get("replyObserved") is True
        ),
        "targetMatchedHeuristic": True if (
            nested.get("targetMatchedHeuristic") is True or payload.get("targetMatchedHeuristic") is True
        ) else (False if (nested.get("targetMatchedHeuristic") is False or payload.get("targetMatchedHeuristic") is False) else None),
        "sentVisible": bool(
            evaluator_scores.get("sentVisible") is True
            or evaluator_scores.get("transcriptChanged") is True
        ),
        "visibleAfter": nested.get("visibleAfter"),
        "visibleBefore": nested.get("visibleBefore"),
    }


def _hydrate_execute_trace(payload: dict[str, Any], trace_path: Path) -> dict[str, Any]:
    trace = dict(payload)
    result_payload = _read_json_if_exists(trace_path.with_name("result.json"))
    result = _unwrap_result_payload(result_payload)
    send_mode = _normalize_send_mode(trace.get("send_mode")) or result.get("mode")
    if send_mode is not None:
        trace["send_mode"] = send_mode
    if trace.get("send_attempted") is None and send_mode in EXECUTE_MODES and result.get("mode") in EXECUTE_MODES:
        trace["send_attempted"] = True
    if not isinstance(trace.get("target_validation"), dict) and result.get("targetMatchedHeuristic") is not None:
        trace["target_validation"] = {
            "matched": result.get("targetMatchedHeuristic") is True,
            "reason": "desktop_result_bridge" if result.get("targetMatchedHeuristic") is True else "desktop_result_unmatched",
        }
    if not isinstance(trace.get("send_result"), dict) and send_mode in EXECUTE_MODES and result.get("sentVisible") is True:
        trace["send_result"] = {"result": {"status": "sent"}}
    if _normalize_text(trace.get("correlation_status")) is None and send_mode in EXECUTE_MODES:
        if result.get("replyObserved") is True:
            trace["correlation_status"] = "reply_observed"
        elif isinstance(trace.get("send_result"), dict):
            trace["correlation_status"] = "post_send_reply_missing"
    if (
        (
            not isinstance(trace.get("visible_after"), list)
            or len(trace.get("visible_after") or []) <= 0
        )
        and isinstance(result.get("visibleAfter"), list)
    ):
        trace["visible_after"] = result.get("visibleAfter")
    if (
        (
            not isinstance(trace.get("visible_before"), list)
            or len(trace.get("visible_before") or []) <= 0
        )
        and isinstance(result.get("visibleBefore"), list)
    ):
        trace["visible_before"] = result.get("visibleBefore")
    trace["__trace_path"] = str(trace_path.resolve())
    return trace


def _write_json(path_value: str | Path, payload: dict[str, Any]) -> str:
    path_obj = Path(path_value).resolve()
    path_obj.parent.mkdir(parents=True, exist_ok=True)
    path_obj.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path_obj)


def _ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def _discover_execute_traces(output_root: Path) -> list[dict[str, Any]]:
    runs_root = output_root / "runs"
    traces = []
    for trace_path in sorted(runs_root.glob("*/trace.json")):
        payload = _read_json_if_exists(trace_path)
        if not isinstance(payload, dict):
            continue
        payload = _hydrate_execute_trace(payload, trace_path)
        if _normalize_send_mode(payload.get("send_mode")) not in EXECUTE_MODES:
            continue
        traces.append(payload)
    return traces


def _discover_promotion_records(output_root: Path) -> list[dict[str, Any]]:
    promotions_root = output_root / "proposals" / "promotions"
    records = []
    for record_path in sorted(promotions_root.glob("*.json")):
        payload = _read_json_if_exists(record_path)
        if not isinstance(payload, dict):
            continue
        payload["__record_path"] = str(record_path.resolve())
        records.append(payload)
    return records


def _has_post_observation(trace: dict[str, Any]) -> bool:
    if _normalize_text(trace.get("screenshot_after")):
        return True
    if _normalize_text(trace.get("ax_tree_after")):
        return True
    visible_after = trace.get("visible_after")
    if isinstance(visible_after, list) and len(visible_after) > 0:
        return True
    post_observation = trace.get("post_observation")
    if not isinstance(post_observation, dict):
        return False
    capture = post_observation.get("capture_screenshot")
    if isinstance(capture, dict) and _normalize_text(capture.get("status")) == "executed":
        return True
    validate = post_observation.get("validate_target")
    if isinstance(validate, dict) and _normalize_text(validate.get("status")) == "executed":
        return True
    return False


def _trace_send_attempted(trace: dict[str, Any]) -> bool:
    if "send_attempted" in trace:
        return bool(trace.get("send_attempted"))
    send_result = trace.get("send_result")
    if isinstance(send_result, dict) and isinstance(send_result.get("result"), dict):
        return _normalize_text(send_result["result"].get("status")) is not None
    return False


def _build_automatic_section(traces: list[dict[str, Any]], promotions: list[dict[str, Any]]) -> dict[str, Any]:
    attempted_runs = [trace for trace in traces if _trace_send_attempted(trace)]
    open_target_runs = [trace for trace in traces if _normalize_text(trace.get("send_mode")) == "open_target"]
    open_target_mismatch_runs = [
        trace for trace in open_target_runs
        if _normalize_text(trace.get("failure_reason")) == "open_target_mismatch_stop"
    ]
    validated_attempts = [
        trace for trace in attempted_runs
        if isinstance(trace.get("target_validation"), dict) and trace["target_validation"].get("matched") is True
    ]
    sent_runs = [
        trace for trace in attempted_runs
        if isinstance(trace.get("send_result"), dict)
        and isinstance(trace["send_result"].get("result"), dict)
        and _normalize_text(trace["send_result"]["result"].get("status")) == "sent"
    ]
    successful_validated_sends = [
        trace for trace in sent_runs
        if isinstance(trace.get("target_validation"), dict) and trace["target_validation"].get("matched") is True
    ]
    target_mismatch_false_negatives = [
        trace for trace in sent_runs
        if not (isinstance(trace.get("target_validation"), dict) and trace["target_validation"].get("matched") is True)
    ]
    observe_success_runs = [trace for trace in sent_runs if _has_post_observation(trace)]
    reply_correlation_usable_runs = [
        trace for trace in sent_runs
        if _normalize_text(trace.get("correlation_status")) in REPLY_CORRELATION_USABLE
    ]

    proposal_ids = []
    duplicate_promotion_count = 0
    for record in promotions:
        proposal_id = _normalize_text(record.get("proposal_id"))
        if not proposal_id:
            continue
        if proposal_id in proposal_ids:
            duplicate_promotion_count += 1
            continue
        proposal_ids.append(proposal_id)

    metrics = {
        "executeRunCount": len(traces),
        "openTargetRunCount": len(open_target_runs),
        "openTargetMismatchCount": len(open_target_mismatch_runs),
        "attemptedSendCount": len(attempted_runs),
        "validatedAttemptedSendCount": len(validated_attempts),
        "sentCount": len(sent_runs),
        "successfulValidatedSendCount": len(successful_validated_sends),
        "offWhitelistSendIncidents": len(target_mismatch_false_negatives),
        "targetMismatchFalseNegativeCount": len(target_mismatch_false_negatives),
        "observeSuccessCount": len(observe_success_runs),
        "replyCorrelationUsableCount": len(reply_correlation_usable_runs),
        "promotionRecordCount": len(promotions),
        "duplicatePromotionCount": duplicate_promotion_count,
        "sendSuccessRate": _ratio(len(successful_validated_sends), len(validated_attempts)),
        "observeSuccessRate": _ratio(len(observe_success_runs), len(sent_runs)),
        "replyCorrelationUsableRate": _ratio(len(reply_correlation_usable_runs), len(sent_runs)),
        "draftPrDuplicateRate": _ratio(duplicate_promotion_count, len(promotions)) or 0.0,
    }
    gates = [
        {
            "name": "off_whitelist_send_incidents",
            "ok": metrics["offWhitelistSendIncidents"] <= DEFAULT_THRESHOLDS["off_whitelist_send_incidents_max"],
            "actual": metrics["offWhitelistSendIncidents"],
            "threshold": DEFAULT_THRESHOLDS["off_whitelist_send_incidents_max"],
        },
        {
            "name": "target_mismatch_false_negative",
            "ok": metrics["targetMismatchFalseNegativeCount"] <= DEFAULT_THRESHOLDS["target_mismatch_false_negative_max"],
            "actual": metrics["targetMismatchFalseNegativeCount"],
            "threshold": DEFAULT_THRESHOLDS["target_mismatch_false_negative_max"],
        },
        {
            "name": "send_success_rate",
            "ok": metrics["sendSuccessRate"] is not None and metrics["sendSuccessRate"] >= DEFAULT_THRESHOLDS["send_success_rate_min"],
            "actual": metrics["sendSuccessRate"],
            "threshold": DEFAULT_THRESHOLDS["send_success_rate_min"],
        },
        {
            "name": "observe_success_rate",
            "ok": metrics["observeSuccessRate"] is not None and metrics["observeSuccessRate"] >= DEFAULT_THRESHOLDS["observe_success_rate_min"],
            "actual": metrics["observeSuccessRate"],
            "threshold": DEFAULT_THRESHOLDS["observe_success_rate_min"],
        },
        {
            "name": "reply_correlation_usable_rate",
            "ok": metrics["replyCorrelationUsableRate"] is not None and metrics["replyCorrelationUsableRate"] >= DEFAULT_THRESHOLDS["reply_correlation_usable_rate_min"],
            "actual": metrics["replyCorrelationUsableRate"],
            "threshold": DEFAULT_THRESHOLDS["reply_correlation_usable_rate_min"],
        },
        {
            "name": "draft_pr_duplicate_rate",
            "ok": metrics["draftPrDuplicateRate"] <= DEFAULT_THRESHOLDS["draft_pr_duplicate_rate_max"],
            "actual": metrics["draftPrDuplicateRate"],
            "threshold": DEFAULT_THRESHOLDS["draft_pr_duplicate_rate_max"],
        },
    ]
    status = "ready" if all(gate["ok"] for gate in gates) else "blocked"
    return {
        "status": status,
        "metrics": metrics,
        "gates": gates,
        "latestTracePath": traces[-1]["__trace_path"] if traces else None,
    }


def _build_manual_section(manual_report: dict[str, Any] | None, manual_report_path: str | Path | None) -> dict[str, Any]:
    if manual_report is None:
        return {
            "status": "pending",
            "reportPath": str(Path(manual_report_path).resolve()) if manual_report_path else None,
            "gates": [
                {
                    "name": "manual_report_present",
                    "ok": False,
                    "actual": None,
                    "threshold": "required",
                }
            ],
            "report": None,
        }
    execute_once_attempted = int(manual_report.get("execute_once_attempted") or 0)
    execute_once_passed = int(manual_report.get("execute_once_passed") or 0)
    scheduled_attempted = int(manual_report.get("scheduled_execute_attempted") or 0)
    scheduled_passed = int(manual_report.get("scheduled_execute_passed") or 0)
    gates = [
        {
            "name": "accessibility_granted",
            "ok": bool(manual_report.get("accessibility_granted")) is True,
            "actual": bool(manual_report.get("accessibility_granted")),
            "threshold": True,
        },
        {
            "name": "screen_recording_granted",
            "ok": bool(manual_report.get("screen_recording_granted")) is True,
            "actual": bool(manual_report.get("screen_recording_granted")),
            "threshold": True,
        },
        {
            "name": "self_test_target_ready",
            "ok": bool(manual_report.get("self_test_target_ready")) is True,
            "actual": bool(manual_report.get("self_test_target_ready")),
            "threshold": True,
        },
        {
            "name": "execute_once_soak",
            "ok": execute_once_attempted >= DEFAULT_THRESHOLDS["execute_once_min_runs"] and execute_once_passed == execute_once_attempted,
            "actual": {
                "attempted": execute_once_attempted,
                "passed": execute_once_passed,
            },
            "threshold": {
                "attempted_min": DEFAULT_THRESHOLDS["execute_once_min_runs"],
                "passed_equals_attempted": True,
            },
        },
        {
            "name": "scheduled_execute_soak",
            "ok": scheduled_attempted >= DEFAULT_THRESHOLDS["scheduled_execute_min_runs"] and scheduled_passed == scheduled_attempted,
            "actual": {
                "attempted": scheduled_attempted,
                "passed": scheduled_passed,
            },
            "threshold": {
                "attempted_min": DEFAULT_THRESHOLDS["scheduled_execute_min_runs"],
                "passed_equals_attempted": True,
            },
        },
    ]
    status = "ready" if all(gate["ok"] for gate in gates) else "blocked"
    return {
        "status": status,
        "reportPath": str(Path(manual_report_path).resolve()) if manual_report_path else None,
        "gates": gates,
        "report": manual_report,
    }


def run_acceptance_gate(
    *,
    output_root: str | Path,
    manual_report_path: str | Path | None = None,
    output_path: str | Path | None = None,
) -> dict[str, Any]:
    output_root_path = Path(output_root).resolve()
    traces = _discover_execute_traces(output_root_path)
    promotions = _discover_promotion_records(output_root_path)
    manual_report = _read_json_if_exists(manual_report_path)
    automatic = _build_automatic_section(traces, promotions)
    manual = _build_manual_section(manual_report, manual_report_path)
    overall_status = "ready" if automatic["status"] == "ready" and manual["status"] == "ready" else "blocked"
    result = {
        "ok": True,
        "generatedAt": _utc_now().isoformat(),
        "outputRoot": str(output_root_path),
        "thresholds": dict(DEFAULT_THRESHOLDS),
        "overallStatus": overall_status,
        "automatic": automatic,
        "manual": manual,
    }
    if output_path is not None:
        result["outputPath"] = _write_json(output_path, result)
    return result


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate whether the LINE Desktop patrol is ready for completion against automatic and manual acceptance gates.")
    parser.add_argument("--output-root", required=True, help="Directory where local patrol artifacts are written.")
    parser.add_argument("--manual-report", default=None, help="Optional machine-local JSON report for manual host acceptance and soak results.")
    parser.add_argument("--output-path", default="artifacts/line_desktop_patrol/acceptance/latest.json", help="Where to write the acceptance gate summary JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_acceptance_gate(
        output_root=args.output_root,
        manual_report_path=args.manual_report,
        output_path=args.output_path,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
