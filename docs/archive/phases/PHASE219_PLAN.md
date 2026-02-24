# PHASE219_PLAN

## 目的
- 互換 endpoint `POST /api/phaseLLM4/faq/answer` の契約（deprecated metadata / admin endpoint replacement / trace転送）を回帰テストで固定する。

## Scope IN
- phaseLLM4 互換 route 契約テスト追加
- `LLM_API_SPEC` に互換 route 契約の明文化を add-only 追記
- 実行ログ追加

## Scope OUT
- FAQ usecase ロジック変更
- `/api/admin/llm/faq/answer` 実装変更
- 互換 endpoint 削除

## Target Files
- `tests/phase219/phase219_phaseLLM4_compat_route_contract.test.js`
- `docs/LLM_API_SPEC.md`
- `docs/archive/phases/PHASE219_EXECUTION_LOG.md`

## Acceptance / Done
- 互換 route が blocked時にも `deprecated: true` と `replacement` を返す
- 互換 route が `traceId/requestId` を usecase に転送する
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase219/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE219_EXECUTION_LOG.md`
