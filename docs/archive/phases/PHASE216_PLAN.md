# PHASE216_PLAN

## 目的
- `/admin/master` の LLM Ops説明 / 次候補パネルを admin 名前空間 API 優先に更新し、旧 phaseLLM2/3 API は互換フォールバックとして維持する。

## Scope IN
- `apps/admin/master.html` の LLM Ops説明 / 次候補 fetch を admin API 優先へ変更
- 404 または接続失敗時のみ legacy endpoint にフォールバック
- UI回帰テスト追加
- 実行ログ追加

## Scope OUT
- `/api/admin/llm/*` API 仕様変更
- phaseLLM2/3 usecase ロジック変更
- `/api/phaseLLM2/*` `/api/phaseLLM3/*` endpoint 削除

## Target Files
- `apps/admin/master.html`
- `tests/phase216/phase216_master_llm_ops_admin_endpoints.test.js`
- `docs/archive/phases/PHASE216_EXECUTION_LOG.md`

## Acceptance / Done
- master UI が `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` を優先利用
- legacy endpoint へのフォールバックが残っている
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase216/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE216_EXECUTION_LOG.md`
