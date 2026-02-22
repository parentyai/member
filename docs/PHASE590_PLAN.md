# Phase590 Plan

## Goal
Phase587-589 後の read-path 改善値を ratchet 反映し、CI の増悪停止基準を更新する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/READ_PATH_BUDGETS.md`
- `/Users/parentyai.com/Projects/Member/docs/REPO_AUDIT_INPUTS/load_risk.json`
- `/Users/parentyai.com/Projects/Member/tests/phase590/*`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Non-Goals
- 既存 baseline 削除
- CI判定ロジック変更

## Contract
- `current_baseline_phase590` を add-only 追記
- 既存 baseline は履歴として保持
- `load-risk:check` は末尾 baseline 超過のみ fail（既存契約維持）

## Acceptance
- `load_risk.json` が phase590 実値へ更新される
- `npm run load-risk:check`, `npm run docs-artifacts:check`, `npm run test:docs`, `npm test` が pass

