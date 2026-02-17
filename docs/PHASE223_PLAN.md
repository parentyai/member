# PHASE223_PLAN

## 目的
- `/api/admin/llm/faq/answer` が `x-actor` 非必須（欠落しても 400 にしない）である契約を回帰テストで固定する。

## Scope IN
- `x-actor` 欠落（admin token は有効）でも API が処理を継続し、`x-actor required` で fail-closed しないことをテストで固定
- `LLM_API_SPEC` に `x-actor` の扱い（推奨/任意）を add-only で明記
- 実行ログ追加

## Scope OUT
- FAQ API 実装変更
- `x-actor` を必須化する変更
- KB/LLM ロジック変更

## Target Files
- `tests/phase223/phase223_admin_llm_faq_x_actor_optional.test.js`
- `docs/LLM_API_SPEC.md`
- `docs/PHASE223_EXECUTION_LOG.md`

## Acceptance / Done
- admin token あり + `x-actor` なしで `/api/admin/llm/faq/answer` が 400 にならない
- `node --test tests/phase223/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase223/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE223_EXECUTION_LOG.md`

