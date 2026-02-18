# PHASE253_EXECUTION_LOG

## Branch
- `codex/phase253-city-pack-run-detail`

## Scope
- City Pack source audit run detail API 追加
- `/admin/app` で run detail drilldown + trace open 導線を追加
- phase253 テスト追加

## Commands
- `npm run test:docs`
- `node --test tests/phase253/*.test.js`
- `npm test`

## Test Result
- `npm run test:docs` => PASS (`[docs] OK`)
- `node --test tests/phase253/*.test.js` => PASS (3 passed / 0 failed)
- `npm test` => PASS (678 passed / 0 failed)

## Changed Files
- `src/repos/firestore/sourceEvidenceRepo.js`
- `src/routes/admin/cityPackReviewInbox.js`
- `src/index.js`
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/SSOT_INDEX.md`
- `tests/phase253/phase253_t01_city_pack_audit_run_detail_api.test.js`
- `tests/phase253/phase253_t02_admin_app_city_pack_run_detail_contract.test.js`
- `tests/phase253/phase253_t03_city_pack_run_detail_route_wired.test.js`
- `docs/PHASE253_PLAN.md`
- `docs/PHASE253_EXECUTION_LOG.md`

## CI Evidence
- Pending（PR checks 後に `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase253.log` を保存予定）

## Risks
- run detail の evidence 件数が増えるとレスポンスが重くなるため上限管理が必要。
- traceId 未設定 run は evidence 空表示となる。

## Rollback
- `git revert <phase253 merge commit>`
