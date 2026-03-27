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
        name="capture_screenshot",
        description="Capture a local LINE Desktop screenshot when policy.store_screenshots=true without enabling any send path.",
        mutating=True,
        exposure="public",
        status="observation_ready",
    ),
    ToolSpec(
        name="dump_ax_tree",
        description="Dump a bounded LINE Desktop accessibility summary with timeout-safe degradation and no send path.",
        mutating=True,
        exposure="public",
        status="ax_summary_ready",
    ),
    ToolSpec(
        name="read_visible_messages",
        description="Read a bounded visible text snapshot from LINE Desktop with timeout-safe degradation and no send path.",
        mutating=True,
        exposure="public",
        status="visible_text_ready",
    ),
    ToolSpec(
        name="validate_target",
        description="Validate that the currently frontmost LINE Desktop chat matches the allowlisted target before any send path is attempted.",
        mutating=False,
        exposure="public",
        status="execute_ready",
    ),
    ToolSpec(
        name="open_test_chat",
        description="Open a uniquely matched allowlist chat in LINE Desktop and fail closed on ambiguous or missing target matches.",
        mutating=True,
        exposure="public",
        status="execute_ready",
    ),
    ToolSpec(
        name="run_dry_run_scenario",
        description="Run a local-only dry-run harness and persist a trace artifact without desktop send side effects.",
        mutating=True,
        exposure="public",
        status="dry_run_ready",
    ),
    ToolSpec(
        name="run_guarded_patrol_loop",
        description="Run the local-only guarded loop with policy, blocked-hours, hourly-cap, and kill-switch enforcement before dry-run trace emission.",
        mutating=True,
        exposure="public",
        status="guarded_loop_ready",
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
        description="Append-only local queue and Codex packet writer for reviewable patrol proposals.",
        mutating=True,
        exposure="internal_only",
        status="proposal_queue_ready",
    ),
    ToolSpec(
        name="send_text",
        description="Send one message only after allowlist, kill-switch, blocked-hours, and target-validation guards all pass.",
        mutating=True,
        exposure="public",
        status="execute_ready",
    ),
    ToolSpec(
        name="run_execute_scenario",
        description="Run one bounded execute scenario and persist trace, evaluation, and proposal artifacts without auto-apply.",
        mutating=True,
        exposure="public",
        status="execute_ready",
    ),
    ToolSpec(
        name="promote_proposal_to_draft_pr",
        description="Prepare a dedicated branch/worktree plus draft PR body for one queued proposal without auto-merging or auto-applying changes.",
        mutating=True,
        exposure="internal_only",
        status="draft_pr_ready",
    ),
    ToolSpec(
        name="synthesize_patch_bundle",
        description="Build a human-reviewed patch request bundle from one queued proposal without auto-applying or auto-merging code.",
        mutating=True,
        exposure="internal_only",
        status="patch_task_ready",
    ),
    ToolSpec(
        name="synthesize_code_patch_bundle",
        description="Build a human-reviewed code patch bundle with file snapshots and validation commands without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_patch_bundle_ready",
    ),
    ToolSpec(
        name="synthesize_code_edit_task",
        description="Build a human-reviewed code edit task with per-file patch hints and review checklist without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_edit_task_ready",
    ),
    ToolSpec(
        name="synthesize_code_diff_draft",
        description="Build a human-reviewed code diff draft with apply_patch-ready placeholders without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_diff_draft_ready",
    ),
    ToolSpec(
        name="synthesize_code_edit_bundle",
        description="Build a human-reviewed code edit bundle with worker prompt and expected outputs without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_edit_bundle_ready",
    ),
    ToolSpec(
        name="synthesize_code_apply_draft",
        description="Build a human-reviewed code apply draft with patch document and apply steps without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_apply_draft_ready",
    ),
    ToolSpec(
        name="synthesize_code_apply_task",
        description="Build a human-reviewed code apply task with reviewer checklist and worker prompt without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_apply_task_ready",
    ),
    ToolSpec(
        name="synthesize_code_review_packet",
        description="Build a human-reviewed code review packet with approval checklist and signoff prompt without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_review_packet_ready",
    ),
    ToolSpec(
        name="synthesize_code_apply_evidence",
        description="Build a human-reviewed code apply evidence bundle with final evidence requirements without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_apply_evidence_ready",
    ),
    ToolSpec(
        name="synthesize_code_apply_signoff",
        description="Build a human-reviewed code apply signoff bundle with final approval requirements without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_apply_signoff_ready",
    ),
    ToolSpec(
        name="synthesize_code_apply_record",
        description="Build a human-reviewed code apply record bundle with final closure requirements without auto-applying code.",
        mutating=True,
        exposure="internal_only",
        status="code_apply_record_ready",
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
            "PR4 adds local proposal queue + Codex packet generation without enabling any repo-side write path.",
            "PR6 adds a local guarded loop state file and stop/skip enforcement before the dry-run harness runs.",
            "PR7 adds optional screenshot capture observation when local policy.store_screenshots=true.",
            "PR8 adds a standalone bounded AX summary dump command with timeout-safe degradation.",
            "PR9 wires AX summary dump into the dry-run harness only when local policy.store_ax_tree=true.",
            "PR10 adds a standalone bounded visible message read command without wiring it into the dry-run harness yet.",
            "PR11 wires visible message read into the dry-run harness behind the existing local policy.store_ax_tree gate.",
            "PR12 adds bounded target validation, open_test_chat, and send_text foundations while keeping tracked sample policy dry_run-only.",
            "PR13 adds a one-shot execute harness that writes trace/eval/queue artifacts without enabling auto-apply.",
            "PR15 adds proposal promotion into a prepared branch/worktree and optional draft PR body without auto-merging any code.",
            "PR20 adds patch synthesis bundles that stay artifact-only until a human writes and validates the code diff.",
            "PR21 adds code patch bundles that snapshot candidate files and worktree context while still requiring a human to write the diff.",
            "PR22 adds code edit task bundles with per-file patch hints while still stopping short of code auto-apply.",
            "PR23 adds code diff draft bundles with apply_patch-ready placeholders while still stopping short of code auto-apply.",
            "PR24 adds code edit bundles with worker prompts and expected outputs while still stopping short of code auto-apply.",
            "PR25 adds code apply drafts with patch documents and apply steps while still stopping short of code auto-apply.",
            "PR26 adds code apply tasks with reviewer checklist and task prompt while still stopping short of code auto-apply.",
            "PR27 adds code review packets with approval checklist and signoff prompt while still stopping short of code auto-apply.",
            "PR28 adds code apply evidence bundles with final evidence requirements while still stopping short of code auto-apply.",
            "PR29 adds code apply signoff bundles with final approval requirements while still stopping short of code auto-apply.",
            "PR30 adds code apply record bundles with final closure requirements while still stopping short of code auto-apply.",
            "Later PRs can attach a real MCP transport without changing the schema roots.",
        ],
    }


def main() -> int:
    print(json.dumps(build_server_manifest(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
