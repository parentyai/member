from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import argparse
import json
import platform
import shutil
import subprocess
from typing import Any

LINE_APP_NAME = "LINE"
LINE_BUNDLE_ID = "jp.naver.line.mac"
LINE_BUNDLE_CANDIDATES = (
    Path("/Applications/LINE.app"),
    Path.home() / "Applications" / "LINE.app",
)


@dataclass(frozen=True)
class CommandPlan:
    name: str
    argv: tuple[str, ...]
    mutating: bool
    requires_macos: bool
    description: str


class MacOSLineDesktopAdapter:
    def __init__(self, line_candidates: tuple[Path, ...] | None = None) -> None:
        self.line_candidates = line_candidates or LINE_BUNDLE_CANDIDATES

    def probe_host(self) -> dict[str, Any]:
        is_macos = platform.system() == "Darwin"
        tools = {}
        for name in ("open", "osascript", "screencapture", "python3"):
            tools[name] = {
                "available": shutil.which(name) is not None,
                "path": shutil.which(name),
            }
        line_bundle_path = None
        for candidate in self.line_candidates:
            if candidate.exists():
                line_bundle_path = str(candidate)
                break
        return {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "is_macos": is_macos,
            "line_app_name": LINE_APP_NAME,
            "line_bundle_id": LINE_BUNDLE_ID,
            "line_bundle_path": line_bundle_path,
            "line_bundle_present": line_bundle_path is not None,
            "tools": tools,
        }

    def plan_prepare_line_app(self, target_alias: str | None = None) -> dict[str, Any]:
        plans = [
            CommandPlan(
                name="open_line_app",
                argv=("open", "-a", LINE_APP_NAME),
                mutating=False,
                requires_macos=True,
                description="Launch or foreground the LINE Desktop application.",
            ),
            CommandPlan(
                name="activate_line_app",
                argv=("osascript", "-e", f'tell application "{LINE_APP_NAME}" to activate'),
                mutating=False,
                requires_macos=True,
                description="Ask LINE Desktop to become the frontmost application.",
            ),
        ]
        return {
            "status": "planned",
            "target_alias": target_alias,
            "commands": [asdict(plan) for plan in plans],
        }

    def plan_capture_screenshot(self, output_path: str | Path) -> dict[str, Any]:
        resolved = str(Path(output_path))
        plan = CommandPlan(
            name="capture_screenshot",
            argv=("screencapture", "-x", resolved),
            mutating=False,
            requires_macos=True,
            description="Capture the full screen without UI chrome.",
        )
        return {
            "status": "planned",
            "command": asdict(plan),
            "output_path": resolved,
        }

    def execute_prepare_line_app(self, target_alias: str | None = None) -> dict[str, Any]:
        probe = self.probe_host()
        plan = self.plan_prepare_line_app(target_alias)
        if not probe["is_macos"]:
            return {
                "status": "skipped",
                "reason": "host_not_macos",
                "probe": probe,
                "plan": plan,
            }
        results = []
        for command in plan["commands"]:
            tool_name = command["argv"][0]
            tool_state = probe["tools"].get(tool_name, {})
            if not tool_state.get("available"):
                results.append({
                    "name": command["name"],
                    "status": "skipped",
                    "reason": f"{tool_name}_unavailable",
                })
                continue
            completed = subprocess.run(
                list(command["argv"]),
                check=False,
                capture_output=True,
                text=True,
            )
            results.append({
                "name": command["name"],
                "status": "ok" if completed.returncode == 0 else "failed",
                "returncode": completed.returncode,
                "stdout": completed.stdout.strip() or None,
                "stderr": completed.stderr.strip() or None,
            })
        return {
            "status": "executed",
            "probe": probe,
            "plan": plan,
            "results": results,
        }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect or plan bounded macOS LINE Desktop adapter actions.")
    parser.add_argument("--prepare-line-app", action="store_true", help="Return the bounded LINE app prepare plan.")
    parser.add_argument("--execute", action="store_true", help="Execute the bounded open/activate plan on macOS.")
    parser.add_argument("--target-alias", default=None, help="Optional whitelist alias for plan metadata.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    adapter = MacOSLineDesktopAdapter()
    if args.execute:
        payload = adapter.execute_prepare_line_app(target_alias=args.target_alias)
    elif args.prepare_line_app:
        payload = {
            "probe": adapter.probe_host(),
            "plan": adapter.plan_prepare_line_app(target_alias=args.target_alias),
        }
    else:
        payload = adapter.probe_host()
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
