#!/usr/bin/env python3
import os
import re
import sys
import glob


EVIDENCE_PATTERNS = [
    re.compile(r"Evidence:\s*(UNKNOWN|未記録|未確認|未実施)", re.IGNORECASE),
    re.compile(r"Status=NO"),
]


def read_go_scope_required_paths(repo_root: str) -> list[str]:
    """
    Parse docs/GO_SCOPE.md to extract the "必要範囲（実テスト開始に必要）" section.
    We treat backtick-wrapped paths and '- docs/...' bullet items as candidates.
    """
    path = os.path.join(repo_root, "docs", "GO_SCOPE.md")
    if not os.path.exists(path):
        raise RuntimeError("docs/GO_SCOPE.md not found")

    txt = open(path, "r", encoding="utf-8").read().splitlines()
    in_required = False
    required: list[str] = []
    for line in txt:
        if line.strip().startswith("## 必要範囲"):
            in_required = True
            continue
        if in_required and line.strip().startswith("## "):
            break
        if not in_required:
            continue

        # Extract `docs/foo.md` like tokens.
        for m in re.finditer(r"`([^`]+)`", line):
            tok = m.group(1).strip()
            if tok.endswith(".md") or tok.endswith(".sh") or tok.endswith(".js"):
                required.append(tok)

        # Extract "- docs/FOO.md" bullets.
        m2 = re.match(r"^\s*-\s+((docs|TODO)[^ ]+)$", line.strip())
        if m2:
            tok = m2.group(1).strip()
            if tok.endswith(".md"):
                required.append(tok)

    # De-dup while preserving order.
    seen = set()
    out = []
    for p in required:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def scan_file(repo_root: str, rel_path: str) -> list[tuple[int, str]]:
    abs_path = os.path.join(repo_root, rel_path)
    if not os.path.exists(abs_path):
        return [(0, f"MISSING: {rel_path}")]
    try:
        lines = open(abs_path, "r", encoding="utf-8", errors="replace").read().splitlines()
    except Exception as e:
        return [(0, f"ERROR: {rel_path}: {e}")]

    hits: list[tuple[int, str]] = []
    for i, line in enumerate(lines, start=1):
        for pat in EVIDENCE_PATTERNS:
            if pat.search(line):
                hits.append((i, line.strip()))
                break
    return hits


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    required_raw = read_go_scope_required_paths(repo_root)

    # Expand glob-like entries (GO_SCOPE may contain patterns like docs/PLAYBOOK_PHASE0_*.md).
    required: list[str] = []
    missing_globs: list[str] = []
    for p in required_raw:
        if any(ch in p for ch in ("*", "?", "[")):
            matches = glob.glob(os.path.join(repo_root, p))
            if not matches:
                missing_globs.append(p)
                continue
            for m in sorted(matches):
                required.append(os.path.relpath(m, repo_root))
        else:
            required.append(p)

    # De-dup while preserving order.
    seen = set()
    required = [p for p in required if not (p in seen or seen.add(p))]

    print("go_scope_required_files:")
    for p in required:
        print(f"- {p}")
    print("")

    any_fail = False
    for p in missing_globs:
        any_fail = True
        print(f"FAIL {p}: MISSING_GLOB_MATCH")

    for p in required:
        hits = scan_file(repo_root, p)
        for line_no, line in hits:
            any_fail = True
            if line_no == 0:
                print(f"FAIL {p}: {line}")
            else:
                print(f"FAIL {p}:{line_no}: {line}")

    if any_fail:
        return 1
    print("PASS: no UNKNOWN/未記録/未確認/未実施/Status=NO in GO_SCOPE required files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
