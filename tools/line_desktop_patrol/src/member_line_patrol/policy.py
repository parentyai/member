from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any, Mapping

VALID_DAYS = frozenset({"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"})
VALID_PROPOSAL_MODES = frozenset({"off", "local_queue", "backlog_candidate"})
VALID_AUTO_APPLY_LEVELS = frozenset({"none", "docs_only", "patch_draft"})
VALID_SEND_MODES = frozenset({"dry_run", "execute"})


def _require_mapping(payload: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError(f"{label} must be an object")
    return payload


def _require_bool(payload: Mapping[str, Any], key: str) -> bool:
    value = payload.get(key)
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a boolean")
    return value


def _require_int(payload: Mapping[str, Any], key: str, minimum: int, maximum: int) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or value < minimum or value > maximum:
        raise ValueError(f"{key} must be an integer between {minimum} and {maximum}")
    return value


def _require_float(payload: Mapping[str, Any], key: str, minimum: float, maximum: float) -> float:
    value = payload.get(key)
    if not isinstance(value, (int, float)) or value < minimum or value > maximum:
        raise ValueError(f"{key} must be a number between {minimum} and {maximum}")
    return float(value)


def _require_str(payload: Mapping[str, Any], key: str, *, allow_null: bool = False) -> str | None:
    value = payload.get(key)
    if value is None and allow_null:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


@dataclass(frozen=True)
class BlockedHoursWindow:
    timezone: str
    days: tuple[str, ...]
    start_hour: int
    end_hour: int
    label: str | None = None

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "BlockedHoursWindow":
        record = _require_mapping(payload, "blocked_hours[]")
        timezone = _require_str(record, "timezone")
        raw_days = record.get("days")
        if not isinstance(raw_days, list) or not raw_days:
            raise ValueError("days must be a non-empty array")
        days = tuple(str(day).strip().upper() for day in raw_days)
        if any(day not in VALID_DAYS for day in days):
            raise ValueError("days must contain only MON-SUN")
        start_hour = _require_int(record, "start_hour", 0, 23)
        end_hour = _require_int(record, "end_hour", 1, 24)
        if start_hour >= end_hour:
            raise ValueError("start_hour must be lower than end_hour")
        label = _require_str(record, "label", allow_null=True)
        return cls(
            timezone=timezone,
            days=days,
            start_hour=start_hour,
            end_hour=end_hour,
            label=label,
        )


@dataclass(frozen=True)
class AllowedTarget:
    alias: str
    platform: str
    target_kind: str
    expected_chat_title: str
    expected_window_title_substring: str | None
    expected_participant_labels: tuple[str, ...]
    expected_ax_fingerprint: str | None
    allowed_send_modes: tuple[str, ...]
    notes: str | None = None

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "AllowedTarget":
        record = _require_mapping(payload, "allowed_targets[]")
        alias = _require_str(record, "alias")
        platform = _require_str(record, "platform")
        target_kind = _require_str(record, "target_kind")
        expected_chat_title = _require_str(record, "expected_chat_title")
        expected_window_title_substring = _require_str(record, "expected_window_title_substring", allow_null=True)
        expected_ax_fingerprint = _require_str(record, "expected_ax_fingerprint", allow_null=True)
        raw_participants = record.get("expected_participant_labels")
        if not isinstance(raw_participants, list) or not raw_participants:
            raise ValueError("expected_participant_labels must be a non-empty array")
        participants = tuple(str(item).strip() for item in raw_participants if str(item).strip())
        if not participants:
            raise ValueError("expected_participant_labels must contain at least one non-empty label")
        raw_modes = record.get("allowed_send_modes")
        if not isinstance(raw_modes, list) or not raw_modes:
            raise ValueError("allowed_send_modes must be a non-empty array")
        modes = tuple(str(item).strip() for item in raw_modes if str(item).strip())
        if any(mode not in VALID_SEND_MODES for mode in modes):
            raise ValueError("allowed_send_modes contains an unsupported value")
        notes = _require_str(record, "notes", allow_null=True)
        return cls(
            alias=alias,
            platform=platform,
            target_kind=target_kind,
            expected_chat_title=expected_chat_title,
            expected_window_title_substring=expected_window_title_substring,
            expected_participant_labels=participants,
            expected_ax_fingerprint=expected_ax_fingerprint,
            allowed_send_modes=modes,
            notes=notes,
        )


@dataclass(frozen=True)
class PatrolPolicy:
    enabled: bool
    dry_run_default: bool
    allowed_targets: tuple[AllowedTarget, ...]
    blocked_hours: tuple[BlockedHoursWindow, ...]
    max_runs_per_hour: int
    failure_streak_threshold: int
    ui_drift_threshold: float
    require_target_confirmation: bool
    store_screenshots: bool
    store_ax_tree: bool
    proposal_mode: str
    auto_apply_level: str

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "PatrolPolicy":
        record = _require_mapping(payload, "policy")
        enabled = _require_bool(record, "enabled")
        dry_run_default = _require_bool(record, "dry_run_default")
        raw_targets = record.get("allowed_targets")
        if not isinstance(raw_targets, list) or not raw_targets:
            raise ValueError("allowed_targets must be a non-empty array")
        allowed_targets = tuple(AllowedTarget.from_dict(item) for item in raw_targets)
        raw_blocked_hours = record.get("blocked_hours")
        if not isinstance(raw_blocked_hours, list):
            raise ValueError("blocked_hours must be an array")
        blocked_hours = tuple(BlockedHoursWindow.from_dict(item) for item in raw_blocked_hours)
        max_runs_per_hour = _require_int(record, "max_runs_per_hour", 1, 60)
        failure_streak_threshold = _require_int(record, "failure_streak_threshold", 1, 20)
        ui_drift_threshold = _require_float(record, "ui_drift_threshold", 0, 1)
        require_target_confirmation = _require_bool(record, "require_target_confirmation")
        store_screenshots = _require_bool(record, "store_screenshots")
        store_ax_tree = _require_bool(record, "store_ax_tree")
        proposal_mode = _require_str(record, "proposal_mode")
        if proposal_mode not in VALID_PROPOSAL_MODES:
            raise ValueError("proposal_mode is unsupported")
        auto_apply_level = _require_str(record, "auto_apply_level")
        if auto_apply_level not in VALID_AUTO_APPLY_LEVELS:
            raise ValueError("auto_apply_level is unsupported")
        return cls(
            enabled=enabled,
            dry_run_default=dry_run_default,
            allowed_targets=allowed_targets,
            blocked_hours=blocked_hours,
            max_runs_per_hour=max_runs_per_hour,
            failure_streak_threshold=failure_streak_threshold,
            ui_drift_threshold=ui_drift_threshold,
            require_target_confirmation=require_target_confirmation,
            store_screenshots=store_screenshots,
            store_ax_tree=store_ax_tree,
            proposal_mode=proposal_mode,
            auto_apply_level=auto_apply_level,
        )


def load_policy(path: str | Path) -> PatrolPolicy:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return PatrolPolicy.from_dict(payload)
