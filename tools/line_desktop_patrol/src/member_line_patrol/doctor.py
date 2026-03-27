from __future__ import annotations

from pathlib import Path
import argparse
import json
from typing import Any

from .dry_run_harness import _load_repo_runtime_state, _resolve_repo_root
from .loop_state import load_loop_state
from .macos_adapter import MacOSLineDesktopAdapter
from .policy import load_policy


def _read_json_if_exists(path_value: str | Path | None) -> dict[str, Any] | None:
    if not path_value:
        return None
    path_obj = Path(path_value).resolve()
    if not path_obj.exists():
        return None
    return json.loads(path_obj.read_text(encoding="utf-8"))


def run_doctor(
    *,
    policy_path: str | Path,
    output_root: str | Path,
    route_key: str,
    runtime_state_path: str | Path | None = None,
    latest_summary_path: str | Path | None = None,
) -> dict[str, Any]:
    repo_root = _resolve_repo_root()
    policy = load_policy(policy_path)
    output_root_path = Path(output_root).resolve()
    latest_summary_resolved = Path(latest_summary_path).resolve() if latest_summary_path else repo_root / "tmp" / "line_desktop_patrol_latest.json"
    runtime_state = _load_repo_runtime_state(repo_root, route_key, runtime_state_path)
    loop_state = load_loop_state(output_root_path)
    adapter = MacOSLineDesktopAdapter()
    host_probe = adapter.probe_host()
    latest_summary = _read_json_if_exists(latest_summary_resolved)

    tools = host_probe.get("tools") if isinstance(host_probe.get("tools"), dict) else {}
    execute_capable_targets = [
        target.alias
        for target in policy.allowed_targets
        if "execute" in target.allowed_send_modes
    ]
    diagnostics = {
        "policyLoaded": True,
        "hostIsMacOS": bool(host_probe.get("is_macos")),
        "lineBundlePresent": bool(host_probe.get("line_bundle_present")),
        "osascriptAvailable": bool((tools.get("osascript") or {}).get("available")),
        "screencaptureAvailable": bool((tools.get("screencapture") or {}).get("available")),
        "runtimeStateOk": bool(runtime_state.get("ok")),
        "killSwitchVisible": (
            isinstance(runtime_state.get("global"), dict)
            and ("killSwitch" in runtime_state["global"])
        ),
        "latestSummaryPresent": latest_summary is not None,
        "allowlistCount": len(policy.allowed_targets),
        "executeCapableTargetCount": len(execute_capable_targets),
    }
    blocking_checks = []
    if not diagnostics["hostIsMacOS"]:
        blocking_checks.append("host_not_macos")
    if not diagnostics["lineBundlePresent"]:
        blocking_checks.append("line_bundle_missing")
    if not diagnostics["osascriptAvailable"]:
        blocking_checks.append("osascript_unavailable")
    if not diagnostics["runtimeStateOk"]:
        blocking_checks.append("runtime_state_unavailable")
    if diagnostics["allowlistCount"] <= 0:
        blocking_checks.append("allowlist_missing")
    overall_status = "ready" if not blocking_checks else "degraded"

    return {
        "ok": True,
        "overallStatus": overall_status,
        "repoRoot": str(repo_root),
        "policyPath": str(Path(policy_path).resolve()),
        "outputRoot": str(output_root_path),
        "latestSummaryPath": str(latest_summary_resolved),
        "blockingChecks": blocking_checks,
        "diagnostics": diagnostics,
        "policy": {
            "enabled": policy.enabled,
            "dryRunDefault": policy.dry_run_default,
            "requireTargetConfirmation": policy.require_target_confirmation,
            "blockedHoursCount": len(policy.blocked_hours),
            "allowlistAliases": [target.alias for target in policy.allowed_targets],
            "executeCapableAliases": execute_capable_targets,
        },
        "runtime": runtime_state,
        "hostProbe": host_probe,
        "loopState": loop_state.to_dict(),
        "latestSummary": latest_summary,
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect local LINE Desktop patrol host, policy, runtime, and artifact readiness.")
    parser.add_argument("--policy", required=True, help="Path to the patrol policy JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where local patrol artifacts are written.")
    parser.add_argument("--route-key", default="line-desktop-patrol", help="Route key for runtime state reads.")
    parser.add_argument("--runtime-state-path", default=None, help="Optional runtime state JSON fixture path.")
    parser.add_argument("--latest-summary-path", default=None, help="Optional latest summary path override.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_doctor(
        policy_path=args.policy,
        output_root=args.output_root,
        route_key=args.route_key,
        runtime_state_path=args.runtime_state_path,
        latest_summary_path=args.latest_summary_path,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
