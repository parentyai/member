# PHASE227_PLAN

## 目的
- admin LLM Ops 系 endpoint が `x-actor` を usecase へ渡し、監査ログの `actor` が `x-actor` に追随する契約をテストで固定する。

## Scope IN
- `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` の `x-actor` 受け渡し契約テスト追加
- phaseLLM2/3 の監査 `actor` が入力 `actor` に追随する契約テスト追加
- 実行ログ追加

## Scope OUT
- Ops/NextAction API の意味変更
- `x-actor` の必須化（400 化）や認可要件の変更
- LLM 判定/出力仕様変更

## Target Files
- `tests/phase227/phase227_t01_llm_ops_explain_route_passes_x_actor.test.js`
- `tests/phase227/phase227_t02_llm_next_actions_route_passes_x_actor.test.js`
- `tests/phase227/phase227_t03_ops_explain_audit_actor_uses_param.test.js`
- `tests/phase227/phase227_t04_next_actions_audit_actor_uses_param.test.js`
- `docs/PHASE227_EXECUTION_LOG.md`

## Acceptance / Done
- admin route が `x-actor` を usecase params `actor` として渡す
- usecase の監査ログ `actor` が params `actor` に追随する
- `node --test tests/phase227/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase227/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE227_EXECUTION_LOG.md`

