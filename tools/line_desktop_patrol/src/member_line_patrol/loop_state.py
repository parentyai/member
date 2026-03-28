from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
from typing import Any, Mapping

RECENT_RUN_LIMIT = 50
PRESERVE_STREAK_DECISIONS = frozenset({
    "policy_disabled_stop",
    "kill_switch_stop",
    "blocked_hours_skip",
    "max_runs_per_hour_skip",
    "failure_streak_stop",
    "open_target_mismatch_stop",
    "open_target_ready",
})
RESET_STREAK_DECISIONS = frozenset({
    "",
    "dry_run_only_skip",
    "execute_sent",
    "execute_evaluated",
    "execute_queued",
    "post_send_reply_missing",
    "post_send_reply_ambiguous",
})


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_dt(value: Any) -> datetime | None:
    text = _normalize_text(value)
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class RecentRun:
    run_id: str
    started_at: str
    finished_at: str
    decision: str | None
    target_id: str | None
    send_attempted: bool
    counted_towards_hourly_cap: bool

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "RecentRun":
        return cls(
            run_id=str(payload.get("run_id") or "unknown"),
            started_at=str(payload.get("started_at") or ""),
            finished_at=str(payload.get("finished_at") or ""),
            decision=_normalize_text(payload.get("decision")),
            target_id=_normalize_text(payload.get("target_id")),
            send_attempted=bool(payload.get("send_attempted")),
            counted_towards_hourly_cap=bool(payload.get("counted_towards_hourly_cap")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "decision": self.decision,
            "target_id": self.target_id,
            "send_attempted": self.send_attempted,
            "counted_towards_hourly_cap": self.counted_towards_hourly_cap,
        }


@dataclass(frozen=True)
class PatrolLoopState:
    updated_at: str | None
    failure_streak: int
    last_run_id: str | None
    last_failure_reason: str | None
    recent_runs: tuple[RecentRun, ...]
    last_decision: Mapping[str, Any]

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "PatrolLoopState":
        recent = payload.get("recent_runs")
        if not isinstance(recent, list):
            recent = []
        last_decision = payload.get("last_decision")
        if not isinstance(last_decision, dict):
            last_decision = {}
        return cls(
            updated_at=_normalize_text(payload.get("updated_at")),
            failure_streak=int(payload.get("failure_streak") or 0),
            last_run_id=_normalize_text(payload.get("last_run_id")),
            last_failure_reason=_normalize_text(payload.get("last_failure_reason")),
            recent_runs=tuple(RecentRun.from_dict(item) for item in recent if isinstance(item, dict)),
            last_decision=last_decision,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "updated_at": self.updated_at,
            "failure_streak": self.failure_streak,
            "last_run_id": self.last_run_id,
            "last_failure_reason": self.last_failure_reason,
            "recent_runs": [item.to_dict() for item in self.recent_runs],
            "last_decision": dict(self.last_decision),
        }

    def counted_runs_last_hour(self, now: datetime) -> int:
        cutoff = now.astimezone(timezone.utc) - timedelta(hours=1)
        total = 0
        for item in self.recent_runs:
            if not item.counted_towards_hourly_cap:
                continue
            started_at = _parse_dt(item.started_at)
            if started_at and started_at >= cutoff:
                total += 1
        return total


def default_loop_state() -> PatrolLoopState:
    return PatrolLoopState(
        updated_at=None,
        failure_streak=0,
        last_run_id=None,
        last_failure_reason=None,
        recent_runs=tuple(),
        last_decision={},
    )


def resolve_state_path(output_root: str | Path) -> Path:
    return Path(output_root).resolve() / "runtime" / "state.json"


def load_loop_state(output_root: str | Path) -> PatrolLoopState:
    state_path = resolve_state_path(output_root)
    if not state_path.exists():
        return default_loop_state()
    return PatrolLoopState.from_dict(json.loads(state_path.read_text(encoding="utf-8")))


def _trim_recent_runs(rows: list[RecentRun]) -> list[RecentRun]:
    ordered = sorted(rows, key=lambda item: (_parse_dt(item.started_at) or datetime.min.replace(tzinfo=timezone.utc), item.run_id))
    return ordered[-RECENT_RUN_LIMIT:]


def _next_failure_streak(previous: int, decision: str | None, *, send_attempted: bool) -> int:
    normalized = _normalize_text(decision) or ""
    if normalized in PRESERVE_STREAK_DECISIONS:
        return previous
    if not send_attempted:
        return previous
    if normalized in RESET_STREAK_DECISIONS:
        return 0
    return previous + 1


def update_loop_state(
    output_root: str | Path,
    *,
    now: datetime,
    run_id: str,
    started_at: str,
    finished_at: str,
    decision: str | None,
    target_id: str | None,
    send_attempted: bool,
    counted_towards_hourly_cap: bool,
    allowed: bool,
    note: str | None = None,
) -> dict[str, Any]:
    current = load_loop_state(output_root)
    next_failure_streak = _next_failure_streak(current.failure_streak, decision, send_attempted=send_attempted)
    recent_runs = list(current.recent_runs)
    recent_runs.append(RecentRun(
        run_id=run_id,
        started_at=started_at,
        finished_at=finished_at,
        decision=_normalize_text(decision),
        target_id=_normalize_text(target_id),
        send_attempted=send_attempted,
        counted_towards_hourly_cap=counted_towards_hourly_cap,
    ))
    updated = PatrolLoopState(
        updated_at=now.astimezone(timezone.utc).isoformat(),
        failure_streak=next_failure_streak,
        last_run_id=run_id,
        last_failure_reason=_normalize_text(decision),
        recent_runs=tuple(_trim_recent_runs(recent_runs)),
        last_decision={
            "decision": _normalize_text(decision),
            "allowed": bool(allowed),
            "send_attempted": send_attempted,
            "counted_towards_hourly_cap": counted_towards_hourly_cap,
            "at": now.astimezone(timezone.utc).isoformat(),
            "target_id": _normalize_text(target_id),
            "run_id": run_id,
            "note": _normalize_text(note),
        },
    )
    state_path = resolve_state_path(output_root)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(updated.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "state_path": str(state_path),
        "state": updated.to_dict(),
    }
