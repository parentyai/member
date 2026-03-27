from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import argparse
import json
import os
import uuid
from typing import Any

from .dry_run_harness import _resolve_repo_root
from .execute_harness import run_execute_harness
from .scenario_loader import load_scenario

STALE_LOCK_MINUTES = 30


def _resolve_now(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _lock_path(output_root: str | Path) -> Path:
    return Path(output_root).resolve() / "runtime" / "execute.lock.json"


def _read_json_if_exists(path_obj: Path) -> dict[str, Any] | None:
    if not path_obj.exists():
        return None
    return json.loads(path_obj.read_text(encoding="utf-8"))


def _select_scenario_path(
    *,
    scenario_path: str | Path | None,
    scenario_dir: str | Path | None,
    scenario_id: str | None = None,
) -> Path:
    if scenario_path:
        return Path(scenario_path).resolve()
    if not scenario_dir:
        raise ValueError("scenario_path or scenario_dir is required")
    candidates = sorted(Path(scenario_dir).resolve().glob("*.json"))
    if not candidates:
        raise ValueError("scenario_dir does not contain any json scenarios")
    if scenario_id:
        for candidate in candidates:
            loaded = load_scenario(candidate)
            if loaded.scenario_id == scenario_id:
                return candidate.resolve()
        raise ValueError("scenario_id was not found in scenario_dir")
    return candidates[0].resolve()


def _acquire_lock(output_root: str | Path, now: datetime) -> dict[str, Any]:
    lock_path = _lock_path(output_root)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    existing = _read_json_if_exists(lock_path)
    if existing and isinstance(existing, dict):
      issued_at_raw = existing.get("issued_at")
      if isinstance(issued_at_raw, str):
        normalized = issued_at_raw.replace("Z", "+00:00")
        try:
          issued_at = datetime.fromisoformat(normalized)
        except ValueError:
          issued_at = None
        if issued_at is not None and issued_at.tzinfo is None:
          issued_at = issued_at.replace(tzinfo=timezone.utc)
        if issued_at is not None and issued_at.astimezone(timezone.utc) >= now - timedelta(minutes=STALE_LOCK_MINUTES):
          return {
            "acquired": False,
            "reason": "lock_active",
            "lockPath": str(lock_path),
            "existingLock": existing,
          }
    payload = {
        "lock_id": f"execute_lock_{uuid.uuid4().hex[:12]}",
        "issued_at": now.isoformat(),
        "pid": os.getpid(),
    }
    lock_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "acquired": True,
        "lockPath": str(lock_path),
        "lock": payload,
        "replacedStaleLock": bool(existing),
    }


def _release_lock(lock_result: dict[str, Any]) -> None:
    lock_path = lock_result.get("lockPath")
    if not isinstance(lock_path, str):
        return
    path_obj = Path(lock_path)
    if path_obj.exists():
        path_obj.unlink()


def run_execute_loop(
    *,
    policy_path: str | Path,
    output_root: str | Path,
    route_key: str,
    scenario_path: str | Path | None = None,
    scenario_dir: str | Path | None = None,
    scenario_id: str | None = None,
    target_alias: str | None = None,
    runtime_state_path: str | Path | None = None,
    latest_summary_path: str | Path | None = None,
    now_iso: str | None = None,
    reply_wait_window_ms: int = 1500,
    message_text: str | None = None,
) -> dict[str, Any]:
    now = _resolve_now(now_iso)
    selected_scenario_path = _select_scenario_path(
        scenario_path=scenario_path,
        scenario_dir=scenario_dir,
        scenario_id=scenario_id,
    )
    lock_result = _acquire_lock(output_root, now)
    if not lock_result.get("acquired"):
        return {
            "ok": True,
            "allowed": False,
            "decision": "overlap_run_skip",
            "reason": lock_result.get("reason"),
            "lockPath": lock_result.get("lockPath"),
        }
    try:
        result = run_execute_harness(
            policy_path=policy_path,
            scenario_path=selected_scenario_path,
            output_root=output_root,
            route_key=route_key,
            mode="execute_once",
            target_alias=target_alias,
            runtime_state_path=runtime_state_path,
            latest_summary_path=latest_summary_path,
            now_iso=now.isoformat(),
            reply_wait_window_ms=reply_wait_window_ms,
            message_text=message_text,
        )
        return {
            "ok": True,
            "mode": "execute_loop",
            "repoRoot": str(_resolve_repo_root()),
            "selectedScenarioPath": str(selected_scenario_path),
            "lockPath": lock_result.get("lockPath"),
            "lock": lock_result.get("lock"),
            "result": result,
        }
    finally:
        _release_lock(lock_result)


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run one scheduled execute-loop cycle for the LINE Desktop patrol.")
    parser.add_argument("--policy", required=True, help="Path to the patrol policy JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where local execute artifacts should be written.")
    parser.add_argument("--route-key", default="line-desktop-patrol", help="Route key for runtime state reads.")
    parser.add_argument("--scenario", default=None, help="Path to one scenario JSON file.")
    parser.add_argument("--scenario-dir", default=None, help="Optional directory containing execute scenarios.")
    parser.add_argument("--scenario-id", default=None, help="Optional scenario_id selector when scenario-dir is used.")
    parser.add_argument("--target-alias", default=None, help="Optional allowlist alias override.")
    parser.add_argument("--runtime-state-path", default=None, help="Optional runtime state fixture path.")
    parser.add_argument("--latest-summary-path", default=None, help="Optional latest summary path override.")
    parser.add_argument("--now", default=None, help="Optional ISO timestamp override for tests.")
    parser.add_argument("--reply-wait-window-ms", type=int, default=1500, help="Milliseconds to wait before post-send observation.")
    parser.add_argument("--message-text", default=None, help="Optional explicit message override.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_execute_loop(
        policy_path=args.policy,
        output_root=args.output_root,
        route_key=args.route_key,
        scenario_path=args.scenario,
        scenario_dir=args.scenario_dir,
        scenario_id=args.scenario_id,
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
