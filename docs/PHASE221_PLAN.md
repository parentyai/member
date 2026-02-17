# PHASE221_PLAN

## 目的
- `/api/admin/llm/config/*`（status/plan/set）の admin token fail-closed 保護契約を回帰テストで固定する。

## Scope IN
- admin LLM config endpoint 保護テスト追加
- `LLM_API_SPEC` に fail-closed 仕様を add-only 明記
- 実行ログ追加

## Scope OUT
- LLM config API 実装変更
- confirm token 仕様変更
- CSRF 仕様変更

## Target Files
- `tests/phase221/phase221_admin_llm_config_routes_protected.test.js`
- `docs/LLM_API_SPEC.md`
- `docs/PHASE221_EXECUTION_LOG.md`

## Acceptance / Done
- admin token なしで `/api/admin/llm/config/status|plan|set` が 401
- admin token ありで `/api/admin/llm/config/status|plan|set` が 401 以外
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase221/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE221_EXECUTION_LOG.md`
