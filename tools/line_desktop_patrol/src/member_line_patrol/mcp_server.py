from __future__ import annotations

from dataclasses import asdict, dataclass
import json


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    mutating: bool
    exposure: str
    status: str


TOOL_SPECS = (
    ToolSpec(
        name="probe_host_capabilities",
        description="Inspect local macOS command availability and LINE Desktop bundle presence.",
        mutating=False,
        exposure="public",
        status="dry_run_ready",
    ),
    ToolSpec(
        name="get_runtime_state",
        description="Read the local patrol policy state and repo-side global runtime state.",
        mutating=False,
        exposure="public",
        status="scaffold_ready",
    ),
    ToolSpec(
        name="prepare_line_app",
        description="Plan a bounded LINE Desktop open/focus sequence without sending any message.",
        mutating=False,
        exposure="public",
        status="dry_run_ready",
    ),
    ToolSpec(
        name="run_dry_run_scenario",
        description="Run a local-only dry-run harness and persist a trace artifact without desktop send side effects.",
        mutating=True,
        exposure="public",
        status="dry_run_ready",
    ),
    ToolSpec(
        name="list_allowed_targets",
        description="List locally configured whitelist targets for the patrol.",
        mutating=False,
        exposure="public",
        status="scaffold_ready",
    ),
    ToolSpec(
        name="write_trace",
        description="Append-only trace persistence hook for future observation runs.",
        mutating=True,
        exposure="internal_only",
        status="scaffold_ready",
    ),
    ToolSpec(
        name="enqueue_proposal",
        description="Append-only queue for Codex proposal generation based on patrol evidence.",
        mutating=True,
        exposure="internal_only",
        status="scaffold_ready",
    ),
    ToolSpec(
        name="send_text",
        description="Reserved for a later PR. No desktop send path is enabled in PR1.",
        mutating=True,
        exposure="disabled",
        status="planned",
    ),
)


def build_server_manifest() -> dict:
    return {
        "server_name": "member-line-desktop-patrol",
        "status": "skeleton",
        "transport": "placeholder",
        "safe_defaults": {
            "enabled": False,
            "dry_run_default": True,
            "auto_apply_level": "none",
            "requires_whitelist": True,
        },
        "tools": [asdict(tool) for tool in TOOL_SPECS],
        "notes": [
            "PR2 adds host probing and dry-run planning but still keeps send disabled.",
            "Later PRs can attach a real MCP transport without changing the schema roots.",
        ],
    }


def main() -> int:
    print(json.dumps(build_server_manifest(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
