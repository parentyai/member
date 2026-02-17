# PHASE225_PLAN

## 目的
- `/api/admin/llm/faq/answer` が `x-actor` 任意のままでも、`x-actor` が送られている場合は監査ログ（`audit_logs`）の `actor` に反映されることを回帰テストで固定する。

## Scope IN
- `/api/admin/llm/faq/answer` を叩いたときに `audit_logs` の `actor/traceId/action` が契約通りになるテスト追加
- 実行ログ追加

## Scope OUT
- FAQ API 実装変更
- `x-actor` 必須化
- LLM/KB ロジック変更

## Target Files
- `tests/phase225/phase225_admin_llm_faq_audit_actor_from_header.test.js`
- `docs/PHASE225_EXECUTION_LOG.md`

## Acceptance / Done
- `x-actor: admin_master` を送って `/api/admin/llm/faq/answer` を呼ぶと、`audit_logs` に `actor=admin_master` が保存される
- `audit_logs` の `traceId` がリクエストの `x-trace-id` と一致する
- `node --test tests/phase225/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase225/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE225_EXECUTION_LOG.md`

