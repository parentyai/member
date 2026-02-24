# Phase584 Plan

## Goal
read-path 予算の baseline を更新し、改善値を CI ratchet へ固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/scripts/generate_load_risk.js`
- `/Users/parentyai.com/Projects/Member/docs/REPO_AUDIT_INPUTS/load_risk.json`
- `/Users/parentyai.com/Projects/Member/docs/READ_PATH_BUDGETS.md`
- `/Users/parentyai.com/Projects/Member/tests/phase584/*`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Non-Goals
- 旧 baseline セクション削除
- CI fail 条件の緩和

## Contract
- `current_baseline_phase584` を add-only 追記
- `load-risk:check` は末尾 baseline 超過のみ fail

## Acceptance
- 新 baseline が docs に追記される
- `load_risk.json` が最新化される
- `npm run load-risk:check` が pass

