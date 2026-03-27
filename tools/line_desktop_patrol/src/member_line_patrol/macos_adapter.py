from __future__ import annotations

from dataclasses import asdict, dataclass
from collections.abc import Callable
from hashlib import sha256
from pathlib import Path
import argparse
import json
import platform
import shutil
import subprocess
import tempfile
from typing import Any

LINE_APP_NAME = "LINE"
LINE_BUNDLE_ID = "jp.naver.line.mac"
DEFAULT_AX_TIMEOUT_SECONDS = 2.0
DEFAULT_VISIBLE_MESSAGE_LIMIT = 20
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


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _contains_normalized(haystack: Any, needle: Any) -> bool:
    haystack_text = _normalize_text(haystack).casefold()
    needle_text = _normalize_text(needle).casefold()
    if not haystack_text or not needle_text:
        return False
    return needle_text in haystack_text


def _unique_texts(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        text = _normalize_text(value)
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
    return output


def _build_osascript_argv(lines: tuple[str, ...], *args: str) -> tuple[str, ...]:
    argv: list[str] = ["osascript"]
    for line in lines:
        argv.extend(["-e", line])
    if args:
        argv.extend(args)
    return tuple(argv)


class MacOSLineDesktopAdapter:
    def __init__(
        self,
        line_candidates: tuple[Path, ...] | None = None,
        *,
        command_runner: Callable[..., Any] | None = None,
        platform_system: str | None = None,
        platform_release: str | None = None,
        tool_lookup: Callable[[str], str | None] | None = None,
    ) -> None:
        self.line_candidates = line_candidates or LINE_BUNDLE_CANDIDATES
        self.command_runner = command_runner or subprocess.run
        self.platform_system = platform_system
        self.platform_release = platform_release
        self.tool_lookup = tool_lookup or shutil.which

    def _resolve_platform_system(self) -> str:
        return self.platform_system or platform.system()

    def _resolve_platform_release(self) -> str:
        return self.platform_release or platform.release()

    def probe_host(self) -> dict[str, Any]:
        platform_system = self._resolve_platform_system()
        platform_release = self._resolve_platform_release()
        is_macos = platform_system == "Darwin"
        tools = {}
        for name in ("open", "osascript", "screencapture", "python3"):
            resolved_path = self.tool_lookup(name)
            tools[name] = {
                "available": resolved_path is not None,
                "path": resolved_path,
            }
        line_bundle_path = None
        for candidate in self.line_candidates:
            if candidate.exists():
                line_bundle_path = str(candidate)
                break
        return {
            "platform": platform_system,
            "platform_release": platform_release,
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

    def plan_dump_ax_tree(
        self,
        output_path: str | Path,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        resolved = str(Path(output_path))
        argv = (
            "osascript",
            "-e",
            'tell application "System Events"',
            "-e",
            "set uiEnabled to UI elements enabled",
            "-e",
            f'set targetProcess to first application process whose name is "{target_process_name}"',
            "-e",
            "set processName to name of targetProcess",
            "-e",
            "set frontmostState to frontmost of targetProcess",
            "-e",
            "set windowCount to count of windows of targetProcess",
            "-e",
            'set windowName to ""',
            "-e",
            "if windowCount > 0 then set windowName to name of window 1 of targetProcess",
            "-e",
            'return processName & "||" & frontmostState & "||" & windowCount & "||" & windowName & "||" & uiEnabled',
            "-e",
            "end tell",
        )
        plan = CommandPlan(
            name="dump_ax_tree",
            argv=argv,
            mutating=False,
            requires_macos=True,
            description="Dump a bounded LINE Desktop accessibility summary through System Events.",
        )
        return {
            "status": "planned",
            "target_process_name": target_process_name,
            "command": asdict(plan),
            "output_path": resolved,
            "timeout_seconds": timeout_seconds,
        }

    def plan_read_visible_messages(
        self,
        output_path: str | Path,
        target_process_name: str = LINE_APP_NAME,
        *,
        max_items: int = DEFAULT_VISIBLE_MESSAGE_LIMIT,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        resolved = str(Path(output_path))
        argv = (
            "osascript",
            "-e",
            'tell application "System Events"',
            "-e",
            f'set targetProcess to first application process whose name is "{target_process_name}"',
            "-e",
            "set textItems to {}",
            "-e",
            "repeat with targetWindow in windows of targetProcess",
            "-e",
            "try",
            "-e",
            "set textItems to textItems & (value of every static text of targetWindow)",
            "-e",
            "end try",
            "-e",
            "end repeat",
            "-e",
            'set AppleScript\'s text item delimiters to "||"',
            "-e",
            "return textItems as string",
            "-e",
            "end tell",
        )
        plan = CommandPlan(
            name="read_visible_messages",
            argv=argv,
            mutating=False,
            requires_macos=True,
            description="Read a bounded visible text snapshot from LINE Desktop through System Events.",
        )
        return {
            "status": "planned",
            "target_process_name": target_process_name,
            "command": asdict(plan),
            "output_path": resolved,
            "max_items": max_items,
            "timeout_seconds": timeout_seconds,
        }

    def build_target_fingerprint(
        self,
        *,
        ax_payload: dict[str, Any] | None,
        visible_payload: dict[str, Any] | None = None,
    ) -> str:
        visible_items = []
        if isinstance(visible_payload, dict):
            raw_items = visible_payload.get("items")
            if isinstance(raw_items, list):
                visible_items = [
                    _normalize_text(item.get("text"))
                    for item in raw_items
                    if isinstance(item, dict) and _normalize_text(item.get("text"))
                ]
        fingerprint_input = {
            "process_name": _normalize_text((ax_payload or {}).get("process_name")),
            "window_name": _normalize_text((ax_payload or {}).get("window_name")),
            "frontmost": bool((ax_payload or {}).get("frontmost")),
            "window_count": int((ax_payload or {}).get("window_count") or 0),
            "visible_items": visible_items[:10],
        }
        return sha256(
            json.dumps(fingerprint_input, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()[:24]

    def validate_target_observation(
        self,
        *,
        expected_chat_title: str,
        expected_window_title_substring: str | None = None,
        expected_participant_labels: tuple[str, ...] | list[str] = (),
        expected_ax_fingerprint: str | None = None,
        ax_payload: dict[str, Any] | None = None,
        visible_payload: dict[str, Any] | None = None,
        require_confirmation: bool = False,
    ) -> dict[str, Any]:
        ax_payload = ax_payload if isinstance(ax_payload, dict) else {}
        visible_payload = visible_payload if isinstance(visible_payload, dict) else {}
        visible_items = []
        raw_items = visible_payload.get("items")
        if isinstance(raw_items, list):
            visible_items = [
                _normalize_text(item.get("text"))
                for item in raw_items
                if isinstance(item, dict) and _normalize_text(item.get("text"))
            ]
        participant_labels = tuple(
            label for label in (_normalize_text(item) for item in expected_participant_labels) if label
        )
        window_name = _normalize_text(ax_payload.get("window_name"))
        frontmost = bool(ax_payload.get("frontmost"))
        window_title_ok = True
        if expected_window_title_substring:
            window_title_ok = _contains_normalized(window_name, expected_window_title_substring)

        chat_title_matches = []
        if expected_chat_title:
            if _contains_normalized(window_name, expected_chat_title):
                chat_title_matches.append("window_name")
            if any(_contains_normalized(item, expected_chat_title) for item in visible_items):
                chat_title_matches.append("visible_items")
        chat_title_ok = len(chat_title_matches) > 0

        participant_hits = [
            label for label in participant_labels
            if any(_contains_normalized(item, label) for item in visible_items)
        ]
        participants_ok = bool(participant_labels) and len(participant_hits) == len(participant_labels)
        actual_ax_fingerprint = self.build_target_fingerprint(
            ax_payload=ax_payload,
            visible_payload=visible_payload,
        )
        fingerprint_ok = True
        if expected_ax_fingerprint:
            fingerprint_ok = _normalize_text(expected_ax_fingerprint) == actual_ax_fingerprint

        matched_signals = []
        configured_identity_signals = 0
        if _normalize_text(expected_chat_title):
            configured_identity_signals += 1
            if chat_title_ok:
                matched_signals.append("chat_title")
        if participant_labels:
            configured_identity_signals += 1
            if participants_ok:
                matched_signals.append("participant_labels")
        if _normalize_text(expected_ax_fingerprint):
            configured_identity_signals += 1
            if fingerprint_ok:
                matched_signals.append("ax_fingerprint")

        required_identity_signals = 0
        if configured_identity_signals > 0:
            required_identity_signals = 2 if require_confirmation and configured_identity_signals >= 2 else 1
        identity_ok = len(matched_signals) >= required_identity_signals
        matched = frontmost and window_title_ok and fingerprint_ok and identity_ok

        failure_reasons = []
        if not frontmost:
            failure_reasons.append("not_frontmost")
        if not window_title_ok:
            failure_reasons.append("window_title_mismatch")
        if _normalize_text(expected_ax_fingerprint) and not fingerprint_ok:
            failure_reasons.append("ax_fingerprint_mismatch")
        if not identity_ok:
            failure_reasons.append("insufficient_identity_signals")

        return {
            "matched": matched,
            "reason": "matched" if matched else (failure_reasons[0] if failure_reasons else "target_mismatch"),
            "frontmost": frontmost,
            "window_name": window_name or None,
            "window_title_ok": window_title_ok,
            "chat_title_matches": chat_title_matches,
            "participant_hits": participant_hits,
            "participants_ok": participants_ok,
            "actual_ax_fingerprint": actual_ax_fingerprint,
            "expected_ax_fingerprint": _normalize_text(expected_ax_fingerprint) or None,
            "fingerprint_ok": fingerprint_ok,
            "matched_signals": matched_signals,
            "required_identity_signals": required_identity_signals,
            "configured_identity_signals": configured_identity_signals,
            "visible_item_count": len(visible_items),
            "visible_items_sample": visible_items[:10],
            "failure_reasons": failure_reasons,
        }

    def execute_validate_target(
        self,
        *,
        expected_chat_title: str,
        expected_window_title_substring: str | None = None,
        expected_participant_labels: tuple[str, ...] | list[str] = (),
        expected_ax_fingerprint: str | None = None,
        require_confirmation: bool = False,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
        ax_output_path: str | Path | None = None,
        visible_output_path: str | Path | None = None,
        max_items: int = DEFAULT_VISIBLE_MESSAGE_LIMIT,
    ) -> dict[str, Any]:
        ax_path = Path(ax_output_path) if ax_output_path is not None else Path(tempfile.gettempdir()) / "line_desktop_patrol_validate.ax.json"
        visible_path = Path(visible_output_path) if visible_output_path is not None else Path(tempfile.gettempdir()) / "line_desktop_patrol_validate.visible.json"
        ax_dump = self.execute_dump_ax_tree(
            ax_path,
            target_process_name=target_process_name,
            timeout_seconds=timeout_seconds,
        )
        visible_read = self.execute_read_visible_messages(
            visible_path,
            target_process_name=target_process_name,
            max_items=max_items,
            timeout_seconds=timeout_seconds,
        )
        validation = self.validate_target_observation(
            expected_chat_title=expected_chat_title,
            expected_window_title_substring=expected_window_title_substring,
            expected_participant_labels=expected_participant_labels,
            expected_ax_fingerprint=expected_ax_fingerprint,
            ax_payload=ax_dump.get("payload_summary") if ax_dump.get("status") == "executed" else None,
            visible_payload=visible_read.get("payload_summary") if visible_read.get("status") == "executed" else None,
            require_confirmation=require_confirmation,
        )
        return {
            "status": "executed",
            "ax_dump": ax_dump,
            "visible_read": visible_read,
            "validation": validation,
        }

    def plan_open_test_chat(
        self,
        *,
        target_alias: str | None,
        expected_chat_title: str,
        expected_participant_labels: tuple[str, ...] | list[str] = (),
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        candidate_texts = _unique_texts(
            [_normalize_text(expected_chat_title), *[_normalize_text(item) for item in expected_participant_labels]]
        )
        return {
            "status": "planned",
            "target_alias": target_alias,
            "expected_chat_title": _normalize_text(expected_chat_title) or None,
            "candidate_texts": candidate_texts,
            "timeout_seconds": timeout_seconds,
            "steps": [
                "prepare_line_app",
                "validate_target",
                "attempt_unique_visible_match_click",
                "revalidate_target",
            ],
        }

    def _plan_click_target_candidate(
        self,
        candidate_text: str,
        *,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        resolved_text = _normalize_text(candidate_text)
        argv = _build_osascript_argv(
            (
                "on run argv",
                "set candidateText to item 1 of argv",
                "set targetProcessName to item 2 of argv",
                'tell application "System Events"',
                "tell process targetProcessName",
                "set targetWindow to window 1",
                "set matchedCount to 0",
                'set clickedLabel to ""',
                "set matchRef to missing value",
                "repeat with candidate in entire contents of targetWindow",
                'set candidateTextValue to ""',
                "try",
                "set candidateTextValue to name of candidate as text",
                "end try",
                'if candidateTextValue is "" then',
                "try",
                "set candidateTextValue to value of candidate as text",
                "end try",
                "end if",
                "if candidateTextValue contains candidateText then",
                "set matchedCount to matchedCount + 1",
                "if matchedCount is 1 then",
                "set clickedLabel to candidateTextValue",
                "set matchRef to candidate",
                "end if",
                "end if",
                "end repeat",
                'if matchedCount is 0 then return "no_match||"',
                'if matchedCount > 1 then return "ambiguous||" & clickedLabel',
                "try",
                'perform action "AXPress" of matchRef',
                "on error",
                "click matchRef",
                "end try",
                'return "clicked||" & clickedLabel',
                "end tell",
                "end tell",
                "end run",
            ),
            resolved_text,
            target_process_name,
        )
        plan = CommandPlan(
            name="open_test_chat_candidate",
            argv=argv,
            mutating=True,
            requires_macos=True,
            description="Attempt to click a uniquely matched allowlist chat label in the current LINE window.",
        )
        return {
            "status": "planned",
            "candidate_text": resolved_text,
            "target_process_name": target_process_name,
            "timeout_seconds": timeout_seconds,
            "command": asdict(plan),
        }

    def _execute_click_target_candidate(
        self,
        candidate_text: str,
        *,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        probe = self.probe_host()
        plan = self._plan_click_target_candidate(
            candidate_text,
            target_process_name=target_process_name,
            timeout_seconds=timeout_seconds,
        )
        if not probe["is_macos"]:
            return {"status": "skipped", "reason": "host_not_macos", "probe": probe, "plan": plan}
        osascript_state = probe["tools"].get("osascript", {})
        if not osascript_state.get("available"):
            return {"status": "skipped", "reason": "osascript_unavailable", "probe": probe, "plan": plan}
        try:
            completed = self.command_runner(
                list(plan["command"]["argv"]),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            return {"status": "skipped", "reason": "open_target_timeout", "probe": probe, "plan": plan}
        if completed.returncode != 0:
            return {
                "status": "failed",
                "reason": "osascript_failed",
                "probe": probe,
                "plan": plan,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": completed.stdout.strip() or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        raw_output = completed.stdout.strip()
        click_status, clicked_label = (raw_output.split("||", 1) + [""])[:2]
        return {
            "status": "executed",
            "probe": probe,
            "plan": plan,
            "result": {
                "status": click_status or "unknown",
                "clicked_label": _normalize_text(clicked_label) or None,
                "returncode": completed.returncode,
                "stdout": raw_output or None,
                "stderr": completed.stderr.strip() or None,
            },
        }

    def execute_open_test_chat(
        self,
        *,
        target_alias: str | None,
        expected_chat_title: str,
        expected_window_title_substring: str | None = None,
        expected_participant_labels: tuple[str, ...] | list[str] = (),
        expected_ax_fingerprint: str | None = None,
        require_confirmation: bool = False,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
        ax_output_path: str | Path | None = None,
        visible_output_path: str | Path | None = None,
    ) -> dict[str, Any]:
        prepare = self.execute_prepare_line_app(target_alias=target_alias)
        validation_result = self.execute_validate_target(
            expected_chat_title=expected_chat_title,
            expected_window_title_substring=expected_window_title_substring,
            expected_participant_labels=expected_participant_labels,
            expected_ax_fingerprint=expected_ax_fingerprint,
            require_confirmation=require_confirmation,
            target_process_name=target_process_name,
            timeout_seconds=timeout_seconds,
            ax_output_path=ax_output_path,
            visible_output_path=visible_output_path,
        )
        validation = validation_result.get("validation", {})
        if validation.get("matched"):
            return {
                "status": "executed",
                "reason": "already_open",
                "prepare": prepare,
                "validation": validation_result,
                "open_attempts": [],
            }

        open_attempts = []
        for candidate_text in _unique_texts(
            [_normalize_text(expected_chat_title), *[_normalize_text(item) for item in expected_participant_labels]]
        ):
            attempt = self._execute_click_target_candidate(
                candidate_text,
                target_process_name=target_process_name,
                timeout_seconds=timeout_seconds,
            )
            open_attempts.append(attempt)
            result_status = (
                attempt.get("result", {}).get("status")
                if isinstance(attempt.get("result"), dict)
                else None
            )
            if result_status != "clicked":
                continue
            validation_result = self.execute_validate_target(
                expected_chat_title=expected_chat_title,
                expected_window_title_substring=expected_window_title_substring,
                expected_participant_labels=expected_participant_labels,
                expected_ax_fingerprint=expected_ax_fingerprint,
                require_confirmation=require_confirmation,
                target_process_name=target_process_name,
                timeout_seconds=timeout_seconds,
                ax_output_path=ax_output_path,
                visible_output_path=visible_output_path,
            )
            validation = validation_result.get("validation", {})
            if validation.get("matched"):
                return {
                    "status": "executed",
                    "reason": "opened",
                    "prepare": prepare,
                    "validation": validation_result,
                    "open_attempts": open_attempts,
                }

        return {
            "status": "failed",
            "reason": "target_mismatch_stop",
            "prepare": prepare,
            "validation": validation_result,
            "open_attempts": open_attempts,
        }

    def plan_send_text(
        self,
        message_text: str,
        *,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        argv = _build_osascript_argv(
            (
                "on run argv",
                "set messageText to item 1 of argv",
                "set targetProcessName to item 2 of argv",
                'tell application "System Events"',
                "tell process targetProcessName",
                "set targetWindow to window 1",
                "set targetField to missing value",
                "try",
                "set textAreas to every text area of targetWindow",
                "if (count of textAreas) > 0 then set targetField to item -1 of textAreas",
                "end try",
                "if targetField is missing value then",
                "try",
                "set textFields to every text field of targetWindow",
                "if (count of textFields) > 0 then set targetField to item -1 of textFields",
                "end try",
                "end if",
                'if targetField is missing value then return "composer_missing||none||"',
                "try",
                "set focused of targetField to true",
                "end try",
                "try",
                'set value of targetField to ""',
                "end try",
                "try",
                "set value of targetField to messageText",
                'on error errMsg number errNum',
                'return "set_value_failed||none||" & errMsg',
                "end try",
                'set echoedText to ""',
                "try",
                "set echoedText to value of targetField as text",
                "end try",
                'if echoedText is not equal to messageText then return "echo_mismatch||none||" & echoedText',
                'set sendMethod to "return"',
                'set sendClicked to false',
                "try",
                'set sendButton to first button of targetWindow whose name is "送信"',
                "click sendButton",
                'set sendMethod to "button"',
                "set sendClicked to true",
                "end try",
                "if sendClicked is false then",
                "try",
                'set sendButton to first button of targetWindow whose name is "Send"',
                "click sendButton",
                'set sendMethod to "button"',
                "set sendClicked to true",
                "end try",
                "end if",
                "if sendClicked is false then key code 36",
                'return "sent||" & sendMethod & "||" & echoedText',
                "end tell",
                "end tell",
                "end run",
            ),
            _normalize_text(message_text),
            target_process_name,
        )
        plan = CommandPlan(
            name="send_text",
            argv=argv,
            mutating=True,
            requires_macos=True,
            description="Populate the LINE composer, verify the echo, and trigger send only after validation succeeds.",
        )
        return {
            "status": "planned",
            "target_process_name": target_process_name,
            "timeout_seconds": timeout_seconds,
            "message_length": len(_normalize_text(message_text)),
            "command": asdict(plan),
        }

    def execute_send_text(
        self,
        message_text: str,
        *,
        expected_chat_title: str,
        expected_window_title_substring: str | None = None,
        expected_participant_labels: tuple[str, ...] | list[str] = (),
        expected_ax_fingerprint: str | None = None,
        require_confirmation: bool = False,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
        ax_output_path: str | Path | None = None,
        visible_output_path: str | Path | None = None,
        existing_validation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        probe = self.probe_host()
        message = _normalize_text(message_text)
        plan = self.plan_send_text(
            message,
            target_process_name=target_process_name,
            timeout_seconds=timeout_seconds,
        )
        if not message:
            return {
                "status": "failed",
                "reason": "empty_message",
                "probe": probe,
                "plan": plan,
            }
        if not probe["is_macos"]:
            return {
                "status": "skipped",
                "reason": "host_not_macos",
                "probe": probe,
                "plan": plan,
            }
        osascript_state = probe["tools"].get("osascript", {})
        if not osascript_state.get("available"):
            return {
                "status": "skipped",
                "reason": "osascript_unavailable",
                "probe": probe,
                "plan": plan,
            }
        validation_result = existing_validation
        validation_payload = (
            validation_result.get("validation")
            if isinstance(validation_result, dict)
            else None
        )
        if not isinstance(validation_payload, dict) or not validation_payload.get("matched"):
            validation_result = self.execute_validate_target(
                expected_chat_title=expected_chat_title,
                expected_window_title_substring=expected_window_title_substring,
                expected_participant_labels=expected_participant_labels,
                expected_ax_fingerprint=expected_ax_fingerprint,
                require_confirmation=require_confirmation,
                target_process_name=target_process_name,
                timeout_seconds=timeout_seconds,
                ax_output_path=ax_output_path,
                visible_output_path=visible_output_path,
            )
            validation_payload = validation_result.get("validation", {})
        if not validation_payload.get("matched"):
            return {
                "status": "failed",
                "reason": "target_mismatch_stop",
                "probe": probe,
                "plan": plan,
                "target_validation": validation_result,
            }
        try:
            completed = self.command_runner(
                list(plan["command"]["argv"]),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "skipped",
                "reason": "send_timeout",
                "probe": probe,
                "plan": plan,
                "target_validation": validation_result,
            }
        if completed.returncode != 0:
            return {
                "status": "failed",
                "reason": "osascript_failed",
                "probe": probe,
                "plan": plan,
                "target_validation": validation_result,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": completed.stdout.strip() or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        parts = (completed.stdout.strip().split("||", 2) + ["", "", ""])[:3]
        send_status, send_method, echoed_text = parts
        result_status = send_status or "unknown"
        return {
            "status": "executed" if result_status == "sent" else "failed",
            "reason": "sent" if result_status == "sent" else "send_not_confirmed",
            "probe": probe,
            "plan": plan,
            "target_validation": validation_result,
            "result": {
                "status": result_status,
                "send_method": _normalize_text(send_method) or None,
                "echoed_text": _normalize_text(echoed_text) or None,
                "returncode": completed.returncode,
                "stdout": completed.stdout.strip() or None,
                "stderr": completed.stderr.strip() or None,
            },
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
            completed = self.command_runner(
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

    def execute_capture_screenshot(self, output_path: str | Path) -> dict[str, Any]:
        probe = self.probe_host()
        plan = self.plan_capture_screenshot(output_path)
        if not probe["is_macos"]:
            return {
                "status": "skipped",
                "reason": "host_not_macos",
                "probe": probe,
                "plan": plan,
            }
        screencapture_state = probe["tools"].get("screencapture", {})
        if not screencapture_state.get("available"):
            return {
                "status": "skipped",
                "reason": "screencapture_unavailable",
                "probe": probe,
                "plan": plan,
            }
        resolved_path = Path(plan["output_path"])
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        completed = self.command_runner(
            list(plan["command"]["argv"]),
            check=False,
            capture_output=True,
            text=True,
        )
        file_exists = resolved_path.exists()
        file_size = resolved_path.stat().st_size if file_exists else None
        return {
            "status": "executed",
            "probe": probe,
            "plan": plan,
            "result": {
                "status": "ok" if completed.returncode == 0 else "failed",
                "returncode": completed.returncode,
                "stdout": completed.stdout.strip() or None,
                "stderr": completed.stderr.strip() or None,
            },
            "output_path": str(resolved_path),
            "file_exists": file_exists,
            "file_size": file_size,
        }

    def execute_dump_ax_tree(
        self,
        output_path: str | Path,
        *,
        target_process_name: str = LINE_APP_NAME,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        probe = self.probe_host()
        plan = self.plan_dump_ax_tree(
            output_path,
            target_process_name=target_process_name,
            timeout_seconds=timeout_seconds,
        )
        if not probe["is_macos"]:
            return {
                "status": "skipped",
                "reason": "host_not_macos",
                "probe": probe,
                "plan": plan,
            }
        osascript_state = probe["tools"].get("osascript", {})
        if not osascript_state.get("available"):
            return {
                "status": "skipped",
                "reason": "osascript_unavailable",
                "probe": probe,
                "plan": plan,
            }
        try:
            completed = self.command_runner(
                list(plan["command"]["argv"]),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "skipped",
                "reason": "ax_timeout",
                "probe": probe,
                "plan": plan,
                "timeout_seconds": timeout_seconds,
            }
        if completed.returncode != 0:
            return {
                "status": "failed",
                "reason": "osascript_failed",
                "probe": probe,
                "plan": plan,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": completed.stdout.strip() or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        raw_output = completed.stdout.strip()
        parts = raw_output.split("||", 4)
        if len(parts) != 5:
            return {
                "status": "failed",
                "reason": "invalid_ax_dump_output",
                "probe": probe,
                "plan": plan,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": raw_output or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        process_name, frontmost_state, window_count, window_name, ui_enabled = parts
        try:
            parsed_window_count = int(window_count.strip() or "0")
        except ValueError:
            return {
                "status": "failed",
                "reason": "invalid_ax_window_count",
                "probe": probe,
                "plan": plan,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": raw_output or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        payload = {
            "target_process_name": target_process_name,
            "process_name": process_name,
            "frontmost": frontmost_state.strip().lower() == "true",
            "window_count": parsed_window_count,
            "window_name": window_name or None,
            "ui_elements_enabled": ui_enabled.strip().lower() == "true",
        }
        resolved_path = Path(plan["output_path"])
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        resolved_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return {
            "status": "executed",
            "probe": probe,
            "plan": plan,
            "result": {
                "status": "ok",
                "returncode": completed.returncode,
                "stdout": raw_output or None,
                "stderr": completed.stderr.strip() or None,
            },
            "output_path": str(resolved_path),
            "file_exists": resolved_path.exists(),
            "file_size": resolved_path.stat().st_size,
            "payload_summary": payload,
        }

    def execute_read_visible_messages(
        self,
        output_path: str | Path,
        *,
        target_process_name: str = LINE_APP_NAME,
        max_items: int = DEFAULT_VISIBLE_MESSAGE_LIMIT,
        timeout_seconds: float = DEFAULT_AX_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        probe = self.probe_host()
        plan = self.plan_read_visible_messages(
            output_path,
            target_process_name=target_process_name,
            max_items=max_items,
            timeout_seconds=timeout_seconds,
        )
        if not probe["is_macos"]:
            return {
                "status": "skipped",
                "reason": "host_not_macos",
                "probe": probe,
                "plan": plan,
            }
        osascript_state = probe["tools"].get("osascript", {})
        if not osascript_state.get("available"):
            return {
                "status": "skipped",
                "reason": "osascript_unavailable",
                "probe": probe,
                "plan": plan,
            }
        try:
            completed = self.command_runner(
                list(plan["command"]["argv"]),
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "skipped",
                "reason": "visible_read_timeout",
                "probe": probe,
                "plan": plan,
                "timeout_seconds": timeout_seconds,
            }
        if completed.returncode != 0:
            return {
                "status": "failed",
                "reason": "osascript_failed",
                "probe": probe,
                "plan": plan,
                "result": {
                    "status": "failed",
                    "returncode": completed.returncode,
                    "stdout": completed.stdout.strip() or None,
                    "stderr": completed.stderr.strip() or None,
                },
            }
        raw_output = completed.stdout.strip()
        raw_items = [item.strip() for item in raw_output.split("||")] if raw_output else []
        visible_items = [item for item in raw_items if item][:max_items]
        payload = {
            "target_process_name": target_process_name,
            "max_items": max_items,
            "item_count": len(visible_items),
            "truncated": len([item for item in raw_items if item]) > len(visible_items),
            "items": [
                {
                    "index": index + 1,
                    "role": "unknown",
                    "text": item,
                }
                for index, item in enumerate(visible_items)
            ],
        }
        resolved_path = Path(plan["output_path"])
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        resolved_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return {
            "status": "executed",
            "probe": probe,
            "plan": plan,
            "result": {
                "status": "ok",
                "returncode": completed.returncode,
                "stdout": raw_output or None,
                "stderr": completed.stderr.strip() or None,
            },
            "output_path": str(resolved_path),
            "file_exists": resolved_path.exists(),
            "file_size": resolved_path.stat().st_size,
            "payload_summary": payload,
        }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect or plan bounded macOS LINE Desktop adapter actions.")
    parser.add_argument("--prepare-line-app", action="store_true", help="Return the bounded LINE app prepare plan.")
    parser.add_argument("--capture-screenshot", action="store_true", help="Return or execute the bounded screenshot capture plan.")
    parser.add_argument("--dump-ax-tree", action="store_true", help="Return or execute the bounded AX summary dump plan.")
    parser.add_argument("--read-visible-messages", action="store_true", help="Return or execute the bounded visible text read plan.")
    parser.add_argument("--validate-target", action="store_true", help="Return or execute bounded target validation for the frontmost LINE chat.")
    parser.add_argument("--open-test-chat", action="store_true", help="Return or execute bounded allowlist chat targeting.")
    parser.add_argument("--send-text", action="store_true", help="Return or execute bounded send_text after target validation succeeds.")
    parser.add_argument("--execute", action="store_true", help="Execute the bounded open/activate plan on macOS.")
    parser.add_argument("--target-alias", default=None, help="Optional whitelist alias for plan metadata.")
    parser.add_argument("--output-path", default=None, help="Output path for --capture-screenshot.")
    parser.add_argument("--target-process-name", default=LINE_APP_NAME, help="Process name used by AX and visible-text commands.")
    parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_AX_TIMEOUT_SECONDS, help="Timeout for AX and visible-text execution.")
    parser.add_argument("--max-items", type=int, default=DEFAULT_VISIBLE_MESSAGE_LIMIT, help="Maximum visible text items to keep.")
    parser.add_argument("--expected-chat-title", default=None, help="Expected allowlist chat title for validate/open/send commands.")
    parser.add_argument("--expected-window-title-substring", default=None, help="Expected LINE window title substring for validate/open/send commands.")
    parser.add_argument("--expected-participant-label", action="append", default=None, help="Expected visible participant label. May be repeated.")
    parser.add_argument("--expected-ax-fingerprint", default=None, help="Optional expected AX fingerprint for validate/open/send commands.")
    parser.add_argument("--message-text", default=None, help="Message text for --send-text.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    adapter = MacOSLineDesktopAdapter()
    participant_labels = tuple(args.expected_participant_label or [])

    def _require_expected_chat_title() -> str:
        if not args.expected_chat_title:
            parser.error("--expected-chat-title is required for this command")
        return args.expected_chat_title

    if args.capture_screenshot:
        if not args.output_path:
            parser.error("--output-path is required with --capture-screenshot")
        if args.execute:
            payload = adapter.execute_capture_screenshot(args.output_path)
        else:
            payload = {
                "probe": adapter.probe_host(),
                "plan": adapter.plan_capture_screenshot(args.output_path),
            }
    elif args.dump_ax_tree:
        if not args.output_path:
            parser.error("--output-path is required with --dump-ax-tree")
        if args.execute:
            payload = adapter.execute_dump_ax_tree(
                args.output_path,
                target_process_name=args.target_process_name,
                timeout_seconds=args.timeout_seconds,
            )
        else:
            payload = {
                "probe": adapter.probe_host(),
                "plan": adapter.plan_dump_ax_tree(
                    args.output_path,
                    target_process_name=args.target_process_name,
                    timeout_seconds=args.timeout_seconds,
                ),
            }
    elif args.read_visible_messages:
        if not args.output_path:
            parser.error("--output-path is required with --read-visible-messages")
        if args.execute:
            payload = adapter.execute_read_visible_messages(
                args.output_path,
                target_process_name=args.target_process_name,
                max_items=args.max_items,
                timeout_seconds=args.timeout_seconds,
            )
        else:
            payload = {
                "probe": adapter.probe_host(),
                "plan": adapter.plan_read_visible_messages(
                    args.output_path,
                    target_process_name=args.target_process_name,
                    max_items=args.max_items,
                    timeout_seconds=args.timeout_seconds,
                ),
            }
    elif args.validate_target:
        expected_chat_title = _require_expected_chat_title()
        if args.execute:
            payload = adapter.execute_validate_target(
                expected_chat_title=expected_chat_title,
                expected_window_title_substring=args.expected_window_title_substring,
                expected_participant_labels=participant_labels,
                expected_ax_fingerprint=args.expected_ax_fingerprint,
                target_process_name=args.target_process_name,
                timeout_seconds=args.timeout_seconds,
                ax_output_path=(Path(args.output_path).with_suffix(".ax.json") if args.output_path else None),
                visible_output_path=(Path(args.output_path).with_suffix(".visible.json") if args.output_path else None),
                max_items=args.max_items,
            )
        else:
            payload = {
                "probe": adapter.probe_host(),
                "plan": {
                    "status": "planned",
                    "steps": [
                        "dump_ax_tree",
                        "read_visible_messages",
                        "validate_target_observation",
                    ],
                    "expected_chat_title": expected_chat_title,
                    "expected_window_title_substring": args.expected_window_title_substring,
                    "expected_participant_labels": list(participant_labels),
                    "expected_ax_fingerprint": args.expected_ax_fingerprint,
                },
            }
    elif args.open_test_chat:
        expected_chat_title = _require_expected_chat_title()
        if args.execute:
            payload = adapter.execute_open_test_chat(
                target_alias=args.target_alias,
                expected_chat_title=expected_chat_title,
                expected_window_title_substring=args.expected_window_title_substring,
                expected_participant_labels=participant_labels,
                expected_ax_fingerprint=args.expected_ax_fingerprint,
                target_process_name=args.target_process_name,
                timeout_seconds=args.timeout_seconds,
                ax_output_path=(Path(args.output_path).with_suffix(".ax.json") if args.output_path else None),
                visible_output_path=(Path(args.output_path).with_suffix(".visible.json") if args.output_path else None),
            )
        else:
            payload = {
                "probe": adapter.probe_host(),
                "prepare": adapter.plan_prepare_line_app(target_alias=args.target_alias),
                "plan": adapter.plan_open_test_chat(
                    target_alias=args.target_alias,
                    expected_chat_title=expected_chat_title,
                    expected_participant_labels=participant_labels,
                    timeout_seconds=args.timeout_seconds,
                ),
            }
    elif args.send_text:
        expected_chat_title = _require_expected_chat_title()
        if not args.message_text:
            parser.error("--message-text is required with --send-text")
        if args.execute:
            payload = adapter.execute_send_text(
                args.message_text,
                expected_chat_title=expected_chat_title,
                expected_window_title_substring=args.expected_window_title_substring,
                expected_participant_labels=participant_labels,
                expected_ax_fingerprint=args.expected_ax_fingerprint,
                target_process_name=args.target_process_name,
                timeout_seconds=args.timeout_seconds,
                ax_output_path=(Path(args.output_path).with_suffix(".ax.json") if args.output_path else None),
                visible_output_path=(Path(args.output_path).with_suffix(".visible.json") if args.output_path else None),
            )
        else:
            payload = {
                "probe": adapter.probe_host(),
                "plan": adapter.plan_send_text(
                    args.message_text,
                    target_process_name=args.target_process_name,
                    timeout_seconds=args.timeout_seconds,
                ),
            }
    elif args.execute:
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
