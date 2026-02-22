# Phase591 Plan

## Goal
missing-index fallback surface を docs 生成物として固定し、CI でドリフトと増悪を検知可能にする。

## Scope
- `/Users/parentyai.com/Projects/Member/scripts/generate_missing_index_surface.js` (new)
- `/Users/parentyai.com/Projects/Member/scripts/generate_docs_artifacts.js`
- `/Users/parentyai.com/Projects/Member/package.json`
- `/Users/parentyai.com/Projects/Member/docs/REPO_AUDIT_INPUTS/missing_index_surface.json` (generated)
- `/Users/parentyai.com/Projects/Member/tests/phase591/*`

## Non-Goals
- Firestore schema 変更
- existing API contract 変更

## Contract
- `npm run missing-index-surface:generate`
- `npm run missing-index-surface:check`
- `npm run docs-artifacts:generate` で missing-index surface を同時生成

## Acceptance
- missing-index surface が JSON で生成される
- docs artifacts check で stale を検知できる
- `npm run test:docs` / `npm test` が通る
