"""Member LINE Desktop patrol scaffold."""

from .mcp_server import build_server_manifest
from .policy import AllowedTarget, BlockedHoursWindow, PatrolPolicy, load_policy
from .proposal_queue import ProposalQueue
from .runtime_state import RepoRuntimeState, load_runtime_state
from .trace_store import TraceStore

__all__ = [
    "AllowedTarget",
    "BlockedHoursWindow",
    "PatrolPolicy",
    "ProposalQueue",
    "RepoRuntimeState",
    "TraceStore",
    "build_server_manifest",
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
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
