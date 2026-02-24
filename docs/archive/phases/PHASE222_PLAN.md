# PHASE222_PLAN

## 目的
- `/api/admin/llm/config/*`（status/plan/set）が `x-actor` 必須（400 fail-closed）であることを回帰テストで固定する。

## Scope IN
- `x-actor` 欠落時に 400 を返す契約テスト追加
- 実行ログ追加

## Scope OUT
- LLM config API 実装変更
- confirm token 仕様変更
- CSRF 仕様変更
- 既存テストの意図変更

## Target Files
- `tests/phase222/phase222_admin_llm_config_requires_x_actor.test.js`
- `docs/archive/phases/PHASE222_EXECUTION_LOG.md`

## Acceptance / Done
- admin token あり + `x-actor` なしで `/api/admin/llm/config/status|plan|set` が 400
- `node --test tests/phase222/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase222/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE222_EXECUTION_LOG.md`

