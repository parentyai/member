# Phase UI-A11Y-262 Plan

## Goal
- `/admin/app` の最小判断UIを維持したまま、操作の確実性（見失わない/押し間違えない/キーボード操作）を底上げする。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/tests/phase262/*`

## Out of scope
- KPI/説明ブロックの追加
- 新規API追加
- legacy画面の全面改修

## Acceptance
- `:focus-visible` が統一適用されている（ボタン/summary/input等）
- `prefers-reduced-motion: reduce` でトースト/スケルトン等の動きを抑制できる
- `Alt+0..9` で主要paneに移動できる（入力中は無効）
- `ATTENTION/STOP` により `<details>` が自動展開した際、アクティブpaneのsummaryへフォーカスが移る
- `npm run test:docs` と `npm test` が通る

## Rollback
- PR単位の `git revert` で切戻し

