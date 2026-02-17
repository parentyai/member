# PHASE217_PLAN

## 目的
- `/admin/ops` の LLM Ops説明 / 次候補表示を admin 名前空間 API 優先に更新し、旧 phaseLLM2/3 API は互換フォールバックとして維持する。

## Scope IN
- `apps/admin/ops_readonly.html` の LLM fetch を admin API 優先へ変更
- 404 または接続失敗時のみ legacy endpoint にフォールバック
- UI回帰テスト追加
- 実行ログ追加

## Scope OUT
- `/api/admin/llm/*` API 仕様変更
- phaseLLM2/3 usecase ロジック変更
- `/api/phaseLLM2/*` `/api/phaseLLM3/*` endpoint 削除

## Target Files
- `apps/admin/ops_readonly.html`
- `tests/phase217/phase217_ops_readonly_llm_admin_endpoints.test.js`
- `docs/PHASE217_EXECUTION_LOG.md`

## Acceptance / Done
- ops_readonly が `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` を優先利用
- legacy endpoint へのフォールバックが残っている
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase217/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE217_EXECUTION_LOG.md`
