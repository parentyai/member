# PHASE226_PLAN

## 目的
- `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` が admin token で fail-closed 保護されていることを回帰テストで固定する。

## Scope IN
- admin LLM Ops endpoint 保護契約テスト追加
- 実行ログ追加

## Scope OUT
- Ops/NextAction API 実装変更
- LLM 判定/出力仕様変更
- `x-actor` 必須化

## Target Files
- `tests/phase226/phase226_admin_llm_ops_routes_protected.test.js`
- `docs/PHASE226_EXECUTION_LOG.md`

## Acceptance / Done
- admin token なしで `/api/admin/llm/ops-explain` が 401
- admin token なしで `/api/admin/llm/next-actions` が 401
- admin token ありで両 endpoint が 401 以外（lineUserId未指定で 400 を期待）
- `node --test tests/phase226/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase226/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE226_EXECUTION_LOG.md`

