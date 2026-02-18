# Phase UI-DECISION-263 Plan

## Goal
- DecisionCard の視覚階層を強化し、状態（READY/ATTENTION/STOP）が一目で分かること、理由が「2行で理解できる」ことを契約として固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/tests/phase263/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE_UI_DECISION_263_PLAN.md`
- `/Users/parentyai.com/Projects/Member/docs/PHASE_UI_DECISION_263_EXECUTION_LOG.md`

## Out of scope
- KPI追加 / 説明ブロック追加
- 新規API追加
- legacy画面の同等改修

## Acceptance
- DecisionCard に state class（`is-ready|is-attention|is-stop`）が付与され、左ボーダー色が state 連動する
- 3アクションは維持しつつ、primary action の強弱が付く（`data-action-kind="primary"`）
- 理由は 2行固定（1行目: 要対応、2行目: 主因）
- `npm run test:docs` と `npm test` が通る

## Rollback
- PR単位の `git revert` で切戻し

