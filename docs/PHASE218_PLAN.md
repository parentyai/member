# PHASE218_PLAN

## 目的
- Admin UI 3画面（`/admin/app` / `/admin/master` / `/admin/ops`）の LLM Ops API 呼び出しが「admin優先 + legacy fallback」で統一されている契約をテストと仕様書で固定する。

## Scope IN
- endpoint 優先順序を固定する回帰テスト追加
- `LLM_API_SPEC` に endpoint 優先順序契約を add-only 追記
- 実行ログ追加

## Scope OUT
- API 実装ロジック変更
- phaseLLM2/3 互換ルート削除
- UI表示変更

## Target Files
- `tests/phase218/phase218_llm_admin_endpoint_contract.test.js`
- `docs/LLM_API_SPEC.md`
- `docs/PHASE218_EXECUTION_LOG.md`

## Acceptance / Done
- 3画面すべてで admin endpoint 優先 + legacy fallback をテストで検証
- `docs/LLM_API_SPEC.md` に優先順序契約が明記されている
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase218/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE218_EXECUTION_LOG.md`
