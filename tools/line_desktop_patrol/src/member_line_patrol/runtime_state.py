from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any, Mapping


@dataclass(frozen=True)
class RepoRuntimeState:
    generated_at: str | None
    git_sha: str | None
    service_mode: str
    firestore_project_id: str | None
    global_kill_switch: bool | None
    llm_enabled: bool | None
    automation_mode: str
    notification_caps: Mapping[str, Any]
    read_errors: tuple[str, ...]

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "RepoRuntimeState":
        global_state = payload.get("global") if isinstance(payload.get("global"), dict) else {}
        automation_config = (
            global_state.get("automationConfig")
            if isinstance(global_state.get("automationConfig"), dict)
            else {}
        )
        notification_caps = (
            global_state.get("notificationCaps")
            if isinstance(global_state.get("notificationCaps"), dict)
            else {}
        )
        read_errors = payload.get("readErrors")
        if not isinstance(read_errors, list):
            read_errors = []
        return cls(
            generated_at=payload.get("generatedAt"),
            git_sha=payload.get("gitSha"),
            service_mode=str(payload.get("serviceMode") or "member"),
            firestore_project_id=payload.get("firestoreProjectId"),
            global_kill_switch=global_state.get("killSwitch"),
            llm_enabled=global_state.get("llmEnabled"),
            automation_mode=str(automation_config.get("mode") or "OFF"),
            notification_caps=notification_caps,
            read_errors=tuple(str(item) for item in read_errors),
        )


def load_runtime_state(path: str | Path) -> RepoRuntimeState:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return RepoRuntimeState.from_dict(payload)
