from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
from zoneinfo import ZoneInfo

try:  # pragma: no cover - import shape differs between module/script execution
    from .policy import PatrolPolicy, load_policy
    from .proposal_queue import ProposalQueue
    from .trace_store import TraceStore
except ImportError:  # pragma: no cover - local script execution fallback
    from policy import PatrolPolicy, load_policy
    from proposal_queue import ProposalQueue
    from trace_store import TraceStore

DEFAULT_PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "member-line-desktop-patrol"
SERVER_VERSION = "0.3.0"
LATEST_STATE_PATH = Path("tmp") / "line_desktop_patrol_latest.json"
DESKTOP_CHAT_TITLE_PATTERN = re.compile(r"(メンバー|member)", re.IGNORECASE)


class PatrolError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def classify_desktop_bridge_error(payload_or_text) -> str:
    if isinstance(payload_or_text, dict):
        explicit_code = str(payload_or_text.get("errorCode") or payload_or_text.get("code") or "").strip()
        if explicit_code:
            return explicit_code
        source = str(payload_or_text.get("error") or "")
    else:
        source = str(payload_or_text or "")
    normalized = source.strip().lower()
    if "desktop_session_logged_out" in normalized or "session_logged_out" in normalized:
        return "desktop_session_logged_out"
    return "desktop_ui_failed"


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    mutating: bool
    exposure: str
    status: str
    input_schema: dict


def _tool_specs() -> tuple[ToolSpec, ...]:
    empty_schema = {"type": "object", "properties": {}, "additionalProperties": False}
    return (
        ToolSpec(
            name="get_runtime_state",
            description="Read the local patrol policy state and repo-side global runtime state.",
            mutating=False,
            exposure="public",
            status="mcp_ready",
            input_schema=empty_schema,
        ),
        ToolSpec(
            name="list_allowed_targets",
            description="List locally configured whitelist targets for the patrol without exposing actual LINE IDs.",
            mutating=False,
            exposure="public",
            status="mcp_ready",
            input_schema=empty_schema,
        ),
        ToolSpec(
            name="write_trace",
            description="Append-only trace persistence hook for patrol evidence.",
            mutating=True,
            exposure="internal_only",
            status="mcp_ready",
            input_schema={
                "type": "object",
                "required": ["record"],
                "properties": {
                    "record": {"type": "object"}
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="enqueue_proposal",
            description="Append-only queue for Codex proposal generation based on patrol evidence.",
            mutating=True,
            exposure="internal_only",
            status="proposal_queue_ready",
            input_schema={
                "type": "object",
                "required": ["entry"],
                "properties": {
                    "entry": {"type": "object"}
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="send_text",
            description="Guarded LINE send path for Codex. Uses the existing LINE Messaging API push path, not desktop UI automation.",
            mutating=True,
            exposure="guarded_local_only",
            status="execute_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias", "text"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "text": {"type": "string", "minLength": 1, "maxLength": 1000},
                    "send_mode": {"type": "string", "enum": ["dry_run", "execute"]},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "model_config": {"type": ["object", "null"], "additionalProperties": True},
                    "retrieval_refs": {
                        "type": "array",
                        "items": {"type": ["string", "object"]},
                    },
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="desktop_readiness",
            description="Read-only readiness probe for local LINE Desktop UI control, including Accessibility trust, window resolution, and optional メンバー title matching.",
            mutating=False,
            exposure="guarded_local_only",
            status="mcp_ready",
            input_schema={
                "type": "object",
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="desktop_snapshot",
            description="Read-only desktop snapshot for a LINE chat whose title contains the expected target label. Uses local AX/UI control.",
            mutating=False,
            exposure="guarded_local_only",
            status="mcp_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "model_config": {"type": ["object", "null"], "additionalProperties": True},
                    "retrieval_refs": {
                        "type": "array",
                        "items": {"type": ["string", "object"]},
                    },
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="desktop_run_conversation_loop",
            description="User-account desktop LINE loop: select target chat, send as the desktop user, wait for reply, capture transcript, and enqueue an improvement proposal when the loop fails.",
            mutating=True,
            exposure="guarded_local_only",
            status="mcp_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias", "text"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "text": {"type": "string", "minLength": 1, "maxLength": 1000},
                    "send_mode": {"type": "string", "enum": ["dry_run", "execute"]},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "observe_seconds": {"type": "integer", "minimum": 1, "maximum": 300},
                    "poll_seconds": {"type": "integer", "minimum": 1, "maximum": 30},
                    "expected_reply_substrings": {
                        "type": "array",
                        "items": {"type": "string", "minLength": 1, "maxLength": 256},
                        "maxItems": 16,
                    },
                    "forbidden_reply_substrings": {
                        "type": "array",
                        "items": {"type": "string", "minLength": 1, "maxLength": 256},
                        "maxItems": 16,
                    },
                    "model_config": {"type": ["object", "null"], "additionalProperties": True},
                    "retrieval_refs": {
                        "type": "array",
                        "items": {"type": ["string", "object"]},
                    },
                },
                "additionalProperties": False,
            },
        ),
    )


TOOL_SPECS = _tool_specs()


def _compat_manifest_specs() -> tuple[ToolSpec, ...]:
    return (
        ToolSpec(
            name="validate_target",
            description="Compatibility manifest entry for guarded target validation before execute mode.",
            mutating=False,
            exposure="guarded_local_only",
            status="execute_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="open_test_chat",
            description="Compatibility manifest entry for opening the whitelisted desktop LINE target before execute mode.",
            mutating=True,
            exposure="guarded_local_only",
            status="execute_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="run_execute_scenario",
            description="Compatibility manifest entry for the legacy execute-once scenario wrapper.",
            mutating=True,
            exposure="guarded_local_only",
            status="execute_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias", "text"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "text": {"type": "string", "minLength": 1, "maxLength": 1000},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="run_guarded_patrol_loop",
            description="Compatibility manifest entry for the legacy guarded desktop loop wrapper.",
            mutating=True,
            exposure="guarded_local_only",
            status="guarded_loop_ready",
            input_schema={
                "type": "object",
                "required": ["target_alias", "text"],
                "properties": {
                    "target_alias": {"type": "string", "minLength": 3, "maxLength": 64},
                    "text": {"type": "string", "minLength": 1, "maxLength": 1000},
                    "target_confirmation": {"type": "string", "minLength": 3, "maxLength": 128},
                    "scenario_id": {"type": "string", "minLength": 3, "maxLength": 128},
                    "session_id": {"type": "string", "minLength": 3, "maxLength": 128},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="capture_screenshot",
            description="Compatibility manifest entry for the bounded screenshot observation command.",
            mutating=False,
            exposure="internal_only",
            status="observation_ready",
            input_schema={
                "type": "object",
                "required": ["output_path"],
                "properties": {
                    "output_path": {"type": "string", "minLength": 1},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="dump_ax_tree",
            description="Compatibility manifest entry for the bounded AX summary observation command.",
            mutating=False,
            exposure="internal_only",
            status="ax_summary_ready",
            input_schema={
                "type": "object",
                "required": ["output_path"],
                "properties": {
                    "output_path": {"type": "string", "minLength": 1},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="read_visible_messages",
            description="Compatibility manifest entry for the bounded visible-message observation command.",
            mutating=False,
            exposure="internal_only",
            status="visible_text_ready",
            input_schema={
                "type": "object",
                "required": ["output_path"],
                "properties": {
                    "output_path": {"type": "string", "minLength": 1},
                },
                "additionalProperties": False,
            },
        ),
        ToolSpec(
            name="promote_proposal_to_draft_pr",
            description="Compatibility manifest entry for local proposal promotion into a draft-PR-ready packet.",
            mutating=True,
            exposure="internal_only",
            status="draft_pr_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_patch_bundle",
            description="Compatibility manifest entry for patch-task synthesis.",
            mutating=True,
            exposure="internal_only",
            status="patch_task_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_patch_bundle",
            description="Compatibility manifest entry for code patch bundle synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_patch_bundle_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_edit_task",
            description="Compatibility manifest entry for code edit task synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_edit_task_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_diff_draft",
            description="Compatibility manifest entry for code diff draft synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_diff_draft_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_edit_bundle",
            description="Compatibility manifest entry for code edit bundle synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_edit_bundle_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_apply_draft",
            description="Compatibility manifest entry for code apply draft synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_apply_draft_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_apply_task",
            description="Compatibility manifest entry for code apply task synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_apply_task_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_review_packet",
            description="Compatibility manifest entry for code review packet synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_review_packet_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_apply_evidence",
            description="Compatibility manifest entry for code apply evidence synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_apply_evidence_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_apply_signoff",
            description="Compatibility manifest entry for code apply signoff synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_apply_signoff_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
        ToolSpec(
            name="synthesize_code_apply_record",
            description="Compatibility manifest entry for code apply record synthesis.",
            mutating=True,
            exposure="internal_only",
            status="code_apply_record_ready",
            input_schema={"type": "object", "properties": {}, "additionalProperties": True},
        ),
    )


MANIFEST_TOOL_SPECS = TOOL_SPECS + _compat_manifest_specs()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def artifacts_root() -> Path:
    return repo_root() / "artifacts" / "line_desktop_patrol"


def proposal_queue_path() -> Path:
    return artifacts_root() / "proposals" / "queue.jsonl"


def policy_path() -> Path:
    explicit = os.environ.get("LINE_DESKTOP_PATROL_POLICY_PATH", "").strip()
    if explicit:
        return Path(explicit).expanduser().resolve()
    return repo_root() / "tools" / "line_desktop_patrol" / "config" / "policy.example.json"


def load_local_policy() -> PatrolPolicy:
    return load_policy(policy_path())


def build_server_manifest() -> dict:
    return {
        "server_name": SERVER_NAME,
        "status": "guarded_dual_execute_path",
        "transport": "stdio_jsonrpc",
        "safe_defaults": {
            "enabled": False,
            "dry_run_default": True,
            "auto_apply_level": "none",
            "requires_whitelist": True,
        },
        "tools": [asdict(tool) for tool in MANIFEST_TOOL_SPECS],
        "notes": [
            "send_text uses the existing LINE Messaging API push path and requires target-scoped LINE user id env vars.",
            "desktop_snapshot and desktop_run_conversation_loop use local macOS Accessibility plus OCR evidence and require expected_chat_title containing メンバー.",
            "PR9 wires AX summary dump into the dry-run harness when local policy explicitly enables store_ax_tree.",
            "PR10 adds a standalone bounded visible message read command for local observation only.",
            "PR11 wires visible message read into the dry-run harness while keeping speaker attribution conservative.",
        ],
    }


def sanitize_alias_for_env(alias: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", alias).strip("_").upper()


def target_line_user_env_key(alias: str) -> str:
    normalized = sanitize_alias_for_env(alias)
    return f"LINE_DESKTOP_PATROL_TARGET_{normalized}_LINE_USER_ID"


def require_string(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PatrolError("invalid_args", f"{label} required")
    return value.strip()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def build_runtime_state() -> dict:
    cmd = ["node", str(repo_root() / "tools" / "line_desktop_patrol" / "read_repo_runtime_state.js")]
    completed = subprocess.run(
        cmd,
        cwd=str(repo_root()),
        check=False,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip() or "runtime_state_read_failed"
        raise PatrolError("runtime_state_read_failed", stderr)
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise PatrolError("runtime_state_parse_failed", str(error)) from error


def trace_store() -> TraceStore:
    return TraceStore(artifacts_root())


def proposal_queue() -> ProposalQueue:
    return ProposalQueue(proposal_queue_path())


def list_trace_records() -> list[dict]:
    run_root = artifacts_root() / "runs"
    if not run_root.exists():
        return []
    rows: list[dict] = []
    for trace_path in run_root.glob("*/trace.json"):
        try:
            rows.append(json.loads(trace_path.read_text(encoding="utf-8")))
        except Exception:
            continue
    rows.sort(key=lambda row: str(row.get("finished_at") or row.get("started_at") or ""))
    return rows


def count_recent_runs(hours: int = 1) -> int:
    cutoff = now_utc() - timedelta(hours=hours)
    count = 0
    for row in list_trace_records():
        finished_at = row.get("finished_at")
        try:
            if isinstance(finished_at, str) and datetime.fromisoformat(finished_at.replace("Z", "+00:00")) >= cutoff:
                count += 1
        except ValueError:
            continue
    return count


def consecutive_failure_count() -> int:
    count = 0
    for row in reversed(list_trace_records()):
        if row.get("failure_reason"):
            count += 1
            continue
        break
    return count


def is_blocked_now(policy: PatrolPolicy) -> tuple[bool, str | None]:
    current = now_utc()
    for window in policy.blocked_hours:
        zone_now = current.astimezone(ZoneInfo(window.timezone))
        if zone_now.strftime("%a").upper()[:3] not in window.days:
            continue
        if window.start_hour <= zone_now.hour < window.end_hour:
            return True, window.label or "blocked_hours"
    return False, None


def build_trace_record(
    *,
    run_id: str,
    scenario_id: str,
    session_id: str,
    target_alias: str,
    text: str,
    started_at: str,
    finished_at: str,
    git_sha: str | None,
    result: dict | None,
    failure_reason: str | None,
    model_config: dict | None,
    retrieval_refs: list,
    runtime_state: dict | None,
) -> dict:
    visible_before = []
    visible_after = []
    screenshot_before = None
    screenshot_after = None
    evaluator_scores = None
    transport = "line_api_push"
    if isinstance(result, dict):
        visible_before = normalize_visible_entries(result.get("visibleBefore"), fallback_text=result.get("transcriptBefore"))
        visible_after = normalize_visible_entries(result.get("visibleAfter"), fallback_text=result.get("transcriptAfterReply"))
        screenshot_before = normalize_optional_string(result.get("screenshotBeforePath"))
        screenshot_after = normalize_optional_string(result.get("screenshotAfterPath"))
        if isinstance(result.get("evaluatorScores"), dict):
            evaluator_scores = result.get("evaluatorScores")
        if isinstance(result.get("transport"), str) and result.get("transport").strip():
            transport = result.get("transport").strip()
    return {
        "run_id": run_id,
        "scenario_id": scenario_id,
        "session_id": session_id,
        "started_at": started_at,
        "finished_at": finished_at,
        "git_sha": git_sha or "unknown0",
        "app_version": f"{SERVER_NAME}@{SERVER_VERSION}",
        "target_id": target_alias,
        "sent_text": text,
        "visible_before": visible_before,
        "visible_after": visible_after,
        "screenshot_before": screenshot_before,
        "screenshot_after": screenshot_after,
        "ax_tree_before": None,
        "ax_tree_after": None,
        "model_config": model_config,
        "retrieval_refs": retrieval_refs,
        "evaluator_scores": evaluator_scores or {
            "transport": transport,
            "result_ok": bool(result and result.get("ok") is True),
        },
        "failure_reason": failure_reason,
        "proposal_id": None,
        "execution_result": result,
        "runtime_state": runtime_state,
    }


def normalize_optional_string(value) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def normalize_visible_entries(value, *, fallback_text=None) -> list[dict]:
    if isinstance(value, list):
        entries = []
        for item in value:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "").strip() or "visible_text"
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            entries.append({"role": role, "text": text})
        if entries:
            return entries
    if isinstance(fallback_text, str):
        lines = [line.strip() for line in fallback_text.replace("\r", "\n").split("\n") if line.strip()]
        return [{"role": "visible_text", "text": line} for line in lines]
    return []


def write_latest_state(payload: dict) -> None:
    output_path = repo_root() / LATEST_STATE_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_target(policy: PatrolPolicy, alias: str):
    for target in policy.allowed_targets:
        if target.alias == alias:
            return target
    raise PatrolError("target_not_allowed", f"target alias not found: {alias}")


def call_send_bridge(*, line_user_id: str, text: str, run_id: str) -> dict:
    cmd = [
        "node",
        str(repo_root() / "tools" / "line_desktop_patrol" / "send_text_bridge.js"),
        "--line-user-id",
        line_user_id,
        "--text",
        text,
        "--run-id",
        run_id,
    ]
    completed = subprocess.run(
        cmd,
        cwd=str(repo_root()),
        check=False,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    output = completed.stdout.strip() or completed.stderr.strip()
    if completed.returncode != 0:
        raise PatrolError("line_send_failed", output or "line_send_failed")
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as error:
        raise PatrolError("line_send_parse_failed", str(error)) from error
    if payload.get("ok") is not True:
        raise PatrolError("line_send_failed", str(payload.get("error") or "line_send_failed"))
    return payload


def call_desktop_bridge(
    command: str,
    *,
    expected_chat_title: str | None = None,
    run_id: str,
    store_screenshots: bool = False,
    text: str | None = None,
    send_mode: str | None = None,
    observe_seconds: int | None = None,
    poll_seconds: int | None = None,
    expected_reply_substrings: list[str] | None = None,
    forbidden_reply_substrings: list[str] | None = None,
) -> dict:
    cmd = [
        "node",
        str(repo_root() / "tools" / "line_desktop_patrol" / "desktop_ui_bridge.js"),
        command,
        "--run-id",
        run_id,
    ]
    if isinstance(expected_chat_title, str) and expected_chat_title.strip():
        cmd.extend(["--expected-chat-title", expected_chat_title.strip()])
    if store_screenshots:
        cmd.append("--store-screenshots")
    if isinstance(text, str) and text.strip():
        cmd.extend(["--text", text])
    if isinstance(send_mode, str) and send_mode.strip():
        cmd.extend(["--send-mode", send_mode.strip()])
    if isinstance(observe_seconds, int):
        cmd.extend(["--observe-seconds", str(observe_seconds)])
    if isinstance(poll_seconds, int):
        cmd.extend(["--poll-seconds", str(poll_seconds)])
    for item in expected_reply_substrings or []:
        if isinstance(item, str) and item.strip():
            cmd.extend(["--expected-reply-substring", item.strip()])
    for item in forbidden_reply_substrings or []:
        if isinstance(item, str) and item.strip():
            cmd.extend(["--forbidden-reply-substring", item.strip()])
    completed = subprocess.run(
        cmd,
        cwd=str(repo_root()),
        check=False,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    output = completed.stdout.strip() or completed.stderr.strip()
    if completed.returncode != 0:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            code = classify_desktop_bridge_error(output)
            raise PatrolError(code, output or code)
        code = classify_desktop_bridge_error(payload)
        raise PatrolError(code, str(payload.get("error") or code))
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as error:
        raise PatrolError("desktop_ui_parse_failed", str(error)) from error
    if payload.get("ok") is not True:
        code = classify_desktop_bridge_error(payload)
        raise PatrolError(code, str(payload.get("error") or code))
    return payload


def ensure_desktop_target_title(target) -> None:
    title = str(getattr(target, "expected_chat_title", "") or "").strip()
    if not DESKTOP_CHAT_TITLE_PATTERN.search(title):
        raise PatrolError(
            "desktop_target_title_guard",
            "desktop UI control requires expected_chat_title containing メンバー",
        )


def handle_get_runtime_state(_args: dict | None) -> dict:
    policy = load_local_policy()
    runtime = build_runtime_state()
    return {
        "ok": True,
        "policyPath": str(policy_path()),
        "policyEnabled": policy.enabled,
        "dryRunDefault": policy.dry_run_default,
        "runtimeState": runtime,
    }


def handle_desktop_readiness(args: dict | None) -> dict:
    payload = args or {}
    target_alias_value = payload.get("target_alias")
    target_alias = None
    expected_chat_title = None
    if target_alias_value is not None:
        target_alias = require_string(target_alias_value, "target_alias")
        policy = load_local_policy()
        target = resolve_target(policy, target_alias)
        ensure_desktop_target_title(target)
        expected_chat_title = target.expected_chat_title
    result = call_desktop_bridge(
        "readiness",
        run_id=f"line-patrol-{uuid.uuid4()}",
        expected_chat_title=expected_chat_title,
    )
    return {
        "ok": True,
        "targetAlias": target_alias,
        "expectedChatTitle": expected_chat_title,
        "result": result,
    }


def handle_desktop_snapshot(args: dict | None) -> dict:
    payload = args or {}
    target_alias = require_string(payload.get("target_alias"), "target_alias")
    scenario_id = str(payload.get("scenario_id") or "desktop_snapshot").strip() or "desktop_snapshot"
    session_id = str(payload.get("session_id") or f"session-{uuid.uuid4()}").strip()
    model_config = payload.get("model_config") if isinstance(payload.get("model_config"), dict) else None
    retrieval_refs = payload.get("retrieval_refs") if isinstance(payload.get("retrieval_refs"), list) else []

    policy = load_local_policy()
    target = resolve_target(policy, target_alias)
    ensure_desktop_target_title(target)
    runtime = build_runtime_state()
    run_id = f"line-patrol-{uuid.uuid4()}"
    started_at = now_utc().isoformat().replace("+00:00", "Z")
    failure_reason = None
    result = None
    try:
        result = call_desktop_bridge(
            "snapshot",
            expected_chat_title=target.expected_chat_title,
            run_id=run_id,
            store_screenshots=policy.store_screenshots,
        )
        return {
            "ok": True,
            "runId": run_id,
            "targetAlias": target_alias,
            "expectedChatTitle": target.expected_chat_title,
            "result": result,
        }
    except PatrolError as error:
        failure_reason = error.code
        raise
    finally:
        finished_at = now_utc().isoformat().replace("+00:00", "Z")
        trace = build_trace_record(
            run_id=run_id,
            scenario_id=scenario_id,
            session_id=session_id,
            target_alias=target_alias,
            text="",
            started_at=started_at,
            finished_at=finished_at,
            git_sha=runtime.get("gitSha") if isinstance(runtime, dict) else None,
            result=result,
            failure_reason=failure_reason,
            model_config=model_config,
            retrieval_refs=retrieval_refs,
            runtime_state=runtime,
        )
        trace_path = trace_store().write_trace(trace)
        result_path = trace_store().write_json_artifact(
            run_id,
            "result.json",
            {
                "ok": failure_reason is None,
                "mode": "snapshot",
                "targetAlias": target_alias,
                "result": result,
                "failureReason": failure_reason,
                "tracePath": str(trace_path),
            },
        )
        write_latest_state(
            {
                "ok": failure_reason is None,
                "runId": run_id,
                "targetAlias": target_alias,
                "mode": "snapshot",
                "tracePath": str(trace_path),
                "resultPath": str(result_path),
                "failureReason": failure_reason,
            }
        )


def handle_desktop_run_conversation_loop(args: dict | None) -> dict:
    payload = args or {}
    target_alias = require_string(payload.get("target_alias"), "target_alias")
    text = require_string(payload.get("text"), "text")
    scenario_id = str(payload.get("scenario_id") or "desktop_conversation_loop").strip() or "desktop_conversation_loop"
    session_id = str(payload.get("session_id") or f"session-{uuid.uuid4()}").strip()
    send_mode = str(payload.get("send_mode") or "").strip()
    observe_seconds = payload.get("observe_seconds")
    poll_seconds = payload.get("poll_seconds")
    expected_reply_substrings = payload.get("expected_reply_substrings") if isinstance(payload.get("expected_reply_substrings"), list) else []
    forbidden_reply_substrings = payload.get("forbidden_reply_substrings") if isinstance(payload.get("forbidden_reply_substrings"), list) else []
    model_config = payload.get("model_config") if isinstance(payload.get("model_config"), dict) else None
    retrieval_refs = payload.get("retrieval_refs") if isinstance(payload.get("retrieval_refs"), list) else []

    policy = load_local_policy()
    target = resolve_target(policy, target_alias)
    ensure_desktop_target_title(target)
    effective_mode = send_mode or ("dry_run" if policy.dry_run_default else "execute")
    if effective_mode not in {"dry_run", "execute"}:
        raise PatrolError("invalid_send_mode", "send_mode must be dry_run or execute")
    if not policy.enabled:
        raise PatrolError("policy_disabled", "local patrol policy is disabled")
    if effective_mode not in target.allowed_send_modes:
        raise PatrolError("send_mode_not_allowed", f"target {target_alias} does not allow {effective_mode}")
    if policy.require_target_confirmation:
        confirmation = str(payload.get("target_confirmation") or "").strip()
        if confirmation != target_alias:
            raise PatrolError("target_confirmation_required", f"target_confirmation must equal {target_alias}")
    if effective_mode == "execute":
        blocked, block_label = is_blocked_now(policy)
        if blocked:
            raise PatrolError("blocked_hours", f"current time is blocked by {block_label}")
        if count_recent_runs() >= policy.max_runs_per_hour:
            raise PatrolError("rate_limited", "max_runs_per_hour exceeded")
        if consecutive_failure_count() >= policy.failure_streak_threshold:
            raise PatrolError("failure_streak_threshold_reached", "failure streak threshold reached")

    runtime = build_runtime_state()
    if effective_mode == "execute" and runtime.get("global", {}).get("killSwitch") is True:
        raise PatrolError("kill_switch_on", "global kill switch is on")

    run_id = f"line-patrol-{uuid.uuid4()}"
    started_at = now_utc().isoformat().replace("+00:00", "Z")
    failure_reason = None
    result = None
    proposal_enqueued = False
    try:
        result = call_desktop_bridge(
            "conversation-loop",
            expected_chat_title=target.expected_chat_title,
            run_id=run_id,
            store_screenshots=policy.store_screenshots,
            text=text,
            send_mode=effective_mode,
            observe_seconds=observe_seconds if isinstance(observe_seconds, int) else 20,
            poll_seconds=poll_seconds if isinstance(poll_seconds, int) else 2,
            expected_reply_substrings=[str(item).strip() for item in expected_reply_substrings if str(item).strip()],
            forbidden_reply_substrings=[str(item).strip() for item in forbidden_reply_substrings if str(item).strip()],
        )
        if policy.proposal_mode != "off" and isinstance(result.get("proposal"), dict):
            proposal_enqueued = proposal_queue().enqueue(result["proposal"])
        return {
            "ok": True,
            "runId": run_id,
            "mode": effective_mode,
            "targetAlias": target_alias,
            "expectedChatTitle": target.expected_chat_title,
            "proposalEnqueued": proposal_enqueued,
            "result": result,
        }
    except PatrolError as error:
        failure_reason = error.code
        raise
    finally:
        finished_at = now_utc().isoformat().replace("+00:00", "Z")
        trace = build_trace_record(
            run_id=run_id,
            scenario_id=scenario_id,
            session_id=session_id,
            target_alias=target_alias,
            text=text,
            started_at=started_at,
            finished_at=finished_at,
            git_sha=runtime.get("gitSha") if isinstance(runtime, dict) else None,
            result=result,
            failure_reason=failure_reason,
            model_config=model_config,
            retrieval_refs=retrieval_refs,
            runtime_state=runtime,
        )
        trace_path = trace_store().write_trace(trace)
        result_path = trace_store().write_json_artifact(
            run_id,
            "result.json",
            {
                "ok": failure_reason is None,
                "mode": effective_mode,
                "targetAlias": target_alias,
                "result": result,
                "proposalEnqueued": proposal_enqueued,
                "failureReason": failure_reason,
                "tracePath": str(trace_path),
            },
        )
        write_latest_state(
            {
                "ok": failure_reason is None,
                "runId": run_id,
                "targetAlias": target_alias,
                "mode": effective_mode,
                "tracePath": str(trace_path),
                "resultPath": str(result_path),
                "failureReason": failure_reason,
            }
        )


def handle_list_allowed_targets(_args: dict | None) -> dict:
    policy = load_local_policy()
    items = []
    for target in policy.allowed_targets:
        execute_env = target_line_user_env_key(target.alias)
        items.append({
            "alias": target.alias,
            "platform": target.platform,
            "targetKind": target.target_kind,
            "expectedChatTitle": target.expected_chat_title,
            "expectedParticipantLabels": list(target.expected_participant_labels),
            "allowedSendModes": list(target.allowed_send_modes),
            "executeReady": execute_env in os.environ and bool(os.environ.get(execute_env, "").strip()),
            "desktopUiEligible": bool(DESKTOP_CHAT_TITLE_PATTERN.search(target.expected_chat_title or "")),
            "lineUserEnvKey": execute_env,
            "confirmationRequired": policy.require_target_confirmation,
            "notes": target.notes,
        })
    return {
        "ok": True,
        "policyPath": str(policy_path()),
        "policyEnabled": policy.enabled,
        "targets": items,
    }


def handle_write_trace(args: dict | None) -> dict:
    payload = args or {}
    record = payload.get("record")
    if not isinstance(record, dict):
        raise PatrolError("invalid_args", "record object required")
    output_path = trace_store().write_trace(record)
    return {"ok": True, "tracePath": str(output_path)}


def handle_enqueue_proposal(args: dict | None) -> dict:
    payload = args or {}
    entry = payload.get("entry")
    if not isinstance(entry, dict):
        raise PatrolError("invalid_args", "entry object required")
    enqueued = proposal_queue().enqueue(entry)
    return {"ok": True, "enqueued": enqueued, "queuePath": str(proposal_queue_path())}


def handle_send_text(args: dict | None) -> dict:
    payload = args or {}
    target_alias = require_string(payload.get("target_alias"), "target_alias")
    text = require_string(payload.get("text"), "text")
    scenario_id = str(payload.get("scenario_id") or "manual_send_text").strip() or "manual_send_text"
    session_id = str(payload.get("session_id") or f"session-{uuid.uuid4()}").strip()
    send_mode = str(payload.get("send_mode") or "").strip()
    model_config = payload.get("model_config") if isinstance(payload.get("model_config"), dict) else None
    retrieval_refs = payload.get("retrieval_refs") if isinstance(payload.get("retrieval_refs"), list) else []

    policy = load_local_policy()
    target = resolve_target(policy, target_alias)
    effective_mode = send_mode or ("dry_run" if policy.dry_run_default else "execute")
    if effective_mode not in {"dry_run", "execute"}:
        raise PatrolError("invalid_send_mode", "send_mode must be dry_run or execute")
    if not policy.enabled:
        raise PatrolError("policy_disabled", "local patrol policy is disabled")
    if effective_mode not in target.allowed_send_modes:
        raise PatrolError("send_mode_not_allowed", f"target {target_alias} does not allow {effective_mode}")
    if policy.require_target_confirmation:
        confirmation = str(payload.get("target_confirmation") or "").strip()
        if confirmation != target_alias:
            raise PatrolError("target_confirmation_required", f"target_confirmation must equal {target_alias}")

    blocked, block_label = is_blocked_now(policy)
    if blocked:
        raise PatrolError("blocked_hours", f"current time is blocked by {block_label}")
    if count_recent_runs() >= policy.max_runs_per_hour:
        raise PatrolError("rate_limited", "max_runs_per_hour exceeded")
    if consecutive_failure_count() >= policy.failure_streak_threshold:
        raise PatrolError("failure_streak_threshold_reached", "failure streak threshold reached")

    runtime = build_runtime_state()
    if effective_mode == "execute" and runtime.get("global", {}).get("killSwitch") is True:
        raise PatrolError("kill_switch_on", "global kill switch is on")

    run_id = f"line-patrol-{uuid.uuid4()}"
    started_at = now_utc().isoformat().replace("+00:00", "Z")
    failure_reason = None
    result = None
    try:
        if effective_mode == "execute":
            env_key = target_line_user_env_key(target_alias)
            line_user_id = os.environ.get(env_key, "").strip()
            if not line_user_id:
                raise PatrolError("target_line_user_id_missing", f"{env_key} is not set")
            result = call_send_bridge(line_user_id=line_user_id, text=text, run_id=run_id)
        else:
            result = {
                "ok": True,
                "mode": "dry_run",
                "lineUserIdMasked": None,
                "textLength": len(text),
            }
        return_payload = {
            "ok": True,
            "runId": run_id,
            "mode": effective_mode,
            "targetAlias": target_alias,
            "lineUserEnvKey": target_line_user_env_key(target_alias),
            "result": result,
        }
        return return_payload
    except PatrolError as error:
        failure_reason = error.code
        raise
    finally:
        finished_at = now_utc().isoformat().replace("+00:00", "Z")
        trace = build_trace_record(
            run_id=run_id,
            scenario_id=scenario_id,
            session_id=session_id,
            target_alias=target_alias,
            text=text,
            started_at=started_at,
            finished_at=finished_at,
            git_sha=runtime.get("gitSha") if isinstance(runtime, dict) else None,
            result=result,
            failure_reason=failure_reason,
            model_config=model_config,
            retrieval_refs=retrieval_refs,
            runtime_state=runtime,
        )
        trace_path = trace_store().write_trace(trace)
        result_path = trace_store().write_json_artifact(
            run_id,
            "result.json",
            {
                "ok": failure_reason is None,
                "mode": effective_mode,
                "targetAlias": target_alias,
                "result": result,
                "failureReason": failure_reason,
                "tracePath": str(trace_path),
            },
        )
        write_latest_state(
            {
                "ok": failure_reason is None,
                "runId": run_id,
                "targetAlias": target_alias,
                "mode": effective_mode,
                "tracePath": str(trace_path),
                "resultPath": str(result_path),
                "failureReason": failure_reason,
            }
        )


TOOL_HANDLERS = {
    "get_runtime_state": handle_get_runtime_state,
    "list_allowed_targets": handle_list_allowed_targets,
    "write_trace": handle_write_trace,
    "enqueue_proposal": handle_enqueue_proposal,
    "send_text": handle_send_text,
    "desktop_readiness": handle_desktop_readiness,
    "desktop_snapshot": handle_desktop_snapshot,
    "desktop_run_conversation_loop": handle_desktop_run_conversation_loop,
}


def read_message() -> dict | None:
    headers: dict[str, str] = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        decoded = line.decode("utf-8").strip()
        if not decoded:
            break
        key, _, value = decoded.partition(":")
        headers[key.lower()] = value.strip()
    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    payload = sys.stdin.buffer.read(length)
    return json.loads(payload.decode("utf-8"))


def write_message(payload: dict) -> None:
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(encoded)}\r\n\r\n".encode("utf-8"))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def write_result(request_id: object, result: dict) -> None:
    write_message({"jsonrpc": "2.0", "id": request_id, "result": result})


def write_error(request_id: object, code: int, message: str) -> None:
    write_message({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


def tool_result_content(payload: dict, *, is_error: bool) -> dict:
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(payload, ensure_ascii=False, indent=2),
            }
        ],
        "isError": is_error,
    }


def handle_request(message: dict) -> None:
    method = message.get("method")
    request_id = message.get("id")

    if method == "initialize":
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        write_result(
            request_id,
            {
                "protocolVersion": params.get("protocolVersion") or DEFAULT_PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        )
        return

    if method == "notifications/initialized":
        return

    if method == "ping":
        write_result(request_id, {})
        return

    if method == "tools/list":
        write_result(
            request_id,
            {
                "tools": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.input_schema,
                    }
                    for tool in TOOL_SPECS
                ]
            },
        )
        return

    if method == "tools/call":
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        name = params.get("name")
        arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
        handler = TOOL_HANDLERS.get(name)
        if handler is None:
            write_result(request_id, tool_result_content({"ok": False, "error": "tool_not_found"}, is_error=True))
            return
        try:
            payload = handler(arguments)
        except PatrolError as error:
            write_result(
                request_id,
                tool_result_content({"ok": False, "code": error.code, "error": str(error)}, is_error=True),
            )
            return
        except Exception as error:  # pragma: no cover - defensive fallback
            write_result(
                request_id,
                tool_result_content({"ok": False, "code": "internal_error", "error": str(error)}, is_error=True),
            )
            return
        write_result(request_id, tool_result_content(payload, is_error=False))
        return

    if request_id is not None:
        write_error(request_id, -32601, f"Method not found: {method}")


def serve_stdio(initial_message: dict | None = None) -> int:
    if initial_message is not None:
        handle_request(initial_message)
    while True:
        message = read_message()
        if message is None:
            return 0
        handle_request(message)


def manifest_main() -> int:
    print(json.dumps(build_server_manifest(), ensure_ascii=False, indent=2))
    return 0


def serve_main() -> int:
    return serve_stdio()


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--manifest":
        return manifest_main()
    if len(sys.argv) > 1 and sys.argv[1] == "--serve":
        return serve_main()
    first_message = read_message()
    if first_message is None:
        return manifest_main()
    return serve_stdio(first_message)


if __name__ == "__main__":
    raise SystemExit(main())
