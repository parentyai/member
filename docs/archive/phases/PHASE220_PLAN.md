# PHASE220_PLAN

## 目的
- `POST /api/admin/llm/faq/answer` の admin token fail-closed 保護契約を回帰テストで固定する。

## Scope IN
- admin FAQ endpoint 保護テスト追加
- `LLM_API_SPEC` に fail-closed 仕様を add-only 明記
- 実行ログ追加

## Scope OUT
- FAQ回答ロジック変更
- LLM feature gate 変更
- route 実装変更

## Target Files
- `tests/phase220/phase220_admin_llm_faq_route_protected.test.js`
- `docs/LLM_API_SPEC.md`
- `docs/archive/phases/PHASE220_EXECUTION_LOG.md`

## Acceptance / Done
- admin token なしで `/api/admin/llm/faq/answer` が 401
- admin token ありで `/api/admin/llm/faq/answer` が 401 以外
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase220/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE220_EXECUTION_LOG.md`
