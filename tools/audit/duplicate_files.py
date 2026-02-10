#!/usr/bin/env python3
import hashlib
import os
import sys
from collections import defaultdict


EXCLUDE_DIRS = {".git", "node_modules", "artifacts"}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    groups = defaultdict(list)  # (size, sha256) -> [paths]
    hashed = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            path = os.path.join(dirpath, fn)
            try:
                st = os.stat(path)
            except FileNotFoundError:
                continue
            if not os.path.isfile(path) or st.st_size == 0:
                continue
            # Skip large non-text binaries.
            if st.st_size > 2 * 1024 * 1024 and not any(
                path.endswith(ext)
                for ext in (".md", ".js", ".html", ".yml", ".yaml", ".json", ".toml", ".txt", ".sh")
            ):
                continue
            try:
                digest = sha256_file(path)
            except Exception:
                continue
            rel = os.path.relpath(path, root)
            groups[(st.st_size, digest)].append(rel)
            hashed += 1

    dupes = [(k, v) for k, v in groups.items() if len(v) > 1]
    dupes.sort(key=lambda kv: (-kv[0][0], -len(kv[1]), kv[0][1]))

    print(f"hashed_files={hashed}")
    print(f"duplicate_groups={len(dupes)}")
    for (size, digest), paths in dupes:
        print("")
        print(f"size={size} sha256={digest} n={len(paths)}")
        for p in sorted(paths):
            print(p)

    # Do not fail on duplicates; the audit report treats this as WARN.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

