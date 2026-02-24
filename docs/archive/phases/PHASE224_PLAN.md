# PHASE224_PLAN

## 目的
- `x-actor` が任意の `/api/admin/llm/faq/answer` について、admin UI が `x-actor` を必ず送る（actor=unknown を運用で発生させない）ことを回帰テストで固定する。

## Scope IN
- admin UI（`/admin/master`, `/admin/app`）のFAQ呼び出しが `x-actor` を付与する契約テスト追加
- 実行ログ追加

## Scope OUT
- FAQ API 実装変更（`x-actor` 必須化含む）
- LLM/KB ロジック変更
- UI文言/レイアウト変更

## Target Files
- `tests/phase224/phase224_admin_ui_llm_faq_sends_x_actor.test.js`
- `docs/archive/phases/PHASE224_EXECUTION_LOG.md`

## Acceptance / Done
- `apps/admin/master.html` の FAQ 呼び出しが `buildHeaders()`（= `x-actor` 含む）を使うことがテストで固定される
- `apps/admin/assets/admin_app.js` の FAQ 呼び出しが `buildHeaders()`（= `x-actor` 含む）を使うことがテストで固定される
- `node --test tests/phase224/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase224/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE224_EXECUTION_LOG.md`

