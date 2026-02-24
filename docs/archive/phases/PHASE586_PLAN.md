# Phase586 Plan

## Goal
Phase585 の改善値を read-path 予算へ ratchet 追記し、CI で増悪停止を固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/READ_PATH_BUDGETS.md`
- `/Users/parentyai.com/Projects/Member/docs/REPO_AUDIT_INPUTS/load_risk.json`
- `/Users/parentyai.com/Projects/Member/tests/phase586/*`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Non-Goals
- 既存 baseline セクション削除
- CI 判定ロジック緩和

## Contract
- `current_baseline_phase586` を add-only 追記
- `load-risk:check` は末尾 baseline 超過のみ fail（既存契約維持）

## Acceptance
- baseline 追記後に `npm run load-risk:check` が pass
- `npm run test:docs` / `npm test` が通る

