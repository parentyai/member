# PHASE228_PLAN

## 目的
- 互換 endpoint `/api/phaseLLM2/ops-explain` と `/api/phaseLLM3/ops-next-actions` が admin token で fail-closed 保護されていることを回帰テストで固定する。

## Scope IN
- 互換 endpoint の admin token 保護契約テスト追加
- 実行ログ追加

## Scope OUT
- endpoint 実装/レスポンス仕様変更
- 認可要件の変更
- `x-actor` の必須化

## Target Files
- `tests/phase228/phase228_compat_llm_ops_routes_protected.test.js`
- `docs/PHASE228_EXECUTION_LOG.md`

## Acceptance / Done
- admin token なしで `/api/phaseLLM2/ops-explain` が 401
- admin token なしで `/api/phaseLLM3/ops-next-actions` が 401
- admin token ありで両 endpoint が 401 以外（lineUserId未指定で 400 を期待）
- `node --test tests/phase228/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase228/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE228_EXECUTION_LOG.md`

