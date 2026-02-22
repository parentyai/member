# Phase580 Plan

## Goal
docs 生成物ドリフトを 1 コマンドで検知できるようにし、PR の docs ゲート失敗を減らす。

## Scope
- `/Users/parentyai.com/Projects/Member/scripts/generate_docs_artifacts.js` (new)
- `/Users/parentyai.com/Projects/Member/scripts/check_docs_artifacts.js` (new)
- `/Users/parentyai.com/Projects/Member/package.json`
- `/Users/parentyai.com/Projects/Member/.github/workflows/audit.yml`
- `/Users/parentyai.com/Projects/Member/tests/phase580/*`

## Non-Goals
- 既存生成スクリプトの削除
- CI の必須ゲート緩和

## Contract
- `npm run docs-artifacts:generate`
- `npm run docs-artifacts:check`
- docs workflow は `docs-artifacts:check` を利用

## Acceptance
- docs artifacts のチェックが 1 コマンドで実行可能
- `npm run test:docs` と `npm test` が通る

