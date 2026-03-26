"""Member LINE Desktop patrol scaffold."""

from .mcp_server import build_server_manifest
from .loop_state import PatrolLoopState, load_loop_state
from .policy import AllowedTarget, BlockedHoursWindow, PatrolPolicy, load_policy
from .proposal_builder import build_queue_payloads
from .proposal_queue import ProposalQueue
from .runtime_state import RepoRuntimeState, load_runtime_state
from .trace_store import TraceStore

__all__ = [
    "AllowedTarget",
    "BlockedHoursWindow",
    "PatrolPolicy",
    "PatrolLoopState",
    "ProposalQueue",
    "RepoRuntimeState",
    "TraceStore",
    "build_queue_payloads",
    "build_server_manifest",
    "load_loop_state",
    "load_policy",
    "load_runtime_state",
]


def __getattr__(name):
    if name == "MacOSLineDesktopAdapter":
        from .macos_adapter import MacOSLineDesktopAdapter

        return MacOSLineDesktopAdapter
    if name == "PatrolScenario":
        from .scenario_loader import PatrolScenario

        return PatrolScenario
    if name == "load_scenario":
        from .scenario_loader import load_scenario

        return load_scenario
    if name == "run_dry_run_harness":
        from .dry_run_harness import run_dry_run_harness

        return run_dry_run_harness
    if name == "enqueue_eval_proposals":
        from .enqueue_eval_proposals import enqueue_eval_proposals

        return enqueue_eval_proposals
    if name == "run_patrol_loop":
        from .patrol_loop import run_patrol_loop

        return run_patrol_loop
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
