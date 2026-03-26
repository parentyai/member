from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import argparse
import json
from typing import Any


RAW_ARTIFACT_SUFFIXES = (
    ".png",
    ".ax.json",
    ".visible.json",
)


def _resolve_now(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_raw_artifact(path_obj: Path) -> bool:
    name = path_obj.name
    return any(name.endswith(suffix) for suffix in RAW_ARTIFACT_SUFFIXES)


def run_retention(
    *,
    output_root: str | Path,
    now_iso: str | None = None,
    raw_artifact_days: int = 14,
    apply: bool = False,
) -> dict[str, Any]:
    output_root_path = Path(output_root).resolve()
    runs_root = output_root_path / "runs"
    now = _resolve_now(now_iso)
    cutoff = now - timedelta(days=raw_artifact_days)
    candidates = []

    for path_obj in runs_root.rglob("*") if runs_root.exists() else []:
        if not path_obj.is_file():
            continue
        if not _is_raw_artifact(path_obj):
            continue
        modified_at = datetime.fromtimestamp(path_obj.stat().st_mtime, tz=timezone.utc)
        if modified_at >= cutoff:
            continue
        candidates.append({
            "path": str(path_obj),
            "modifiedAt": modified_at.isoformat(),
            "sizeBytes": path_obj.stat().st_size,
        })

    deleted = []
    if apply:
        for item in candidates:
            target_path = Path(item["path"])
            if target_path.exists():
                target_path.unlink()
                deleted.append(item["path"])

    return {
        "ok": True,
        "mode": "apply" if apply else "dry_run",
        "outputRoot": str(output_root_path),
        "rawArtifactDays": raw_artifact_days,
        "generatedAt": now.isoformat(),
        "candidateCount": len(candidates),
        "deletedCount": len(deleted),
        "candidates": candidates,
        "deletedPaths": deleted,
    }


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Apply local retention to LINE Desktop patrol raw artifacts.")
    parser.add_argument("--output-root", required=True, help="Directory where local patrol artifacts are written.")
    parser.add_argument("--now", default=None, help="Optional ISO8601 timestamp override.")
    parser.add_argument("--raw-artifact-days", type=int, default=14, help="Retention window for screenshot / AX / visible raw artifacts.")
    parser.add_argument("--apply", action="store_true", help="Delete raw artifacts instead of returning a dry-run plan.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    result = run_retention(
        output_root=args.output_root,
        now_iso=args.now,
        raw_artifact_days=args.raw_artifact_days,
        apply=args.apply,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
