# Playbook Phase1 Build

Linked Task: P1-004

## Purpose
Phase1のローカル再現手順（設計）を固定する。

## Prerequisites
- Node.js 20.x
- ENV: ENV_NAME / FIRESTORE_PROJECT_ID / PUBLIC_BASE_URL / STORAGE_BUCKET

## Steps
1) Install
   - `npm install`
2) Preflight
   - `npm run preflight`
   - Expected: `preflight ok`
3) Tests
   - `npm test`
   - Expected: Phase1 tests pass

## Notes
- Phase1では repository 経由の書き込みを検証する。
- Linkは `linkRegistryId` のみを使用する。
