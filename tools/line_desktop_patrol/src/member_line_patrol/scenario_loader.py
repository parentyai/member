from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any, Mapping


def _require_mapping(payload: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError(f"{label} must be an object")
    return payload


def _require_string(payload: Mapping[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


def _require_string_list(payload: Mapping[str, Any], key: str) -> tuple[str, ...]:
    raw = payload.get(key)
    if not isinstance(raw, list) or not raw:
        raise ValueError(f"{key} must be a non-empty array")
    values = tuple(str(item).strip() for item in raw if str(item).strip())
    if not values:
        raise ValueError(f"{key} must contain at least one non-empty string")
    return values


@dataclass(frozen=True)
class TimeoutBudget:
    open_target_seconds: int
    observe_seconds: int


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int
    backoff_seconds: int


@dataclass(frozen=True)
class PatrolScenario:
    scenario_id: str
    intent: str
    user_input: str
    expected_behavior: tuple[str, ...]
    expected_routing: tuple[str, ...]
    forbidden_patterns: tuple[str, ...]
    timeout_budget: TimeoutBudget
    retry_policy: RetryPolicy

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "PatrolScenario":
        record = _require_mapping(payload, "scenario")
        timeout_budget_record = _require_mapping(record.get("timeout_budget"), "timeout_budget")
        retry_policy_record = _require_mapping(record.get("retry_policy"), "retry_policy")
        return cls(
            scenario_id=_require_string(record, "scenario_id"),
            intent=_require_string(record, "intent"),
            user_input=_require_string(record, "user_input"),
            expected_behavior=_require_string_list(record, "expected_behavior"),
            expected_routing=_require_string_list(record, "expected_routing"),
            forbidden_patterns=_require_string_list(record, "forbidden_patterns"),
            timeout_budget=TimeoutBudget(
                open_target_seconds=int(timeout_budget_record.get("open_target_seconds")),
                observe_seconds=int(timeout_budget_record.get("observe_seconds")),
            ),
            retry_policy=RetryPolicy(
                max_attempts=int(retry_policy_record.get("max_attempts")),
                backoff_seconds=int(retry_policy_record.get("backoff_seconds")),
            ),
        )


def load_scenario(path: str | Path) -> PatrolScenario:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return PatrolScenario.from_dict(payload)
