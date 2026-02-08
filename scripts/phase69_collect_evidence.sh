#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${1:-}"
if [ -z "${PR_NUMBER}" ]; then
  PR_NUMBER=$(gh pr view --json number --jq .number)
fi

echo "== PR =="
gh pr view "${PR_NUMBER}" --json url,mergeCommit

echo "== Main runs =="
gh run list --branch main --limit 5

echo "== npm test =="
npm test

echo "== origin/main =="
git rev-parse origin/main
