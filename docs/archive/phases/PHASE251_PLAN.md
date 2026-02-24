# PHASE251_PLAN

## Goal
City Pack source audit を定期実行できる運用導線を add-only で追加する（GitHub Actions schedule + internal job token 経路）。

## Scope
- 追加 workflow: `.github/workflows/city-pack-source-audit.yml`
- 追加 runner script: `scripts/city_pack_source_audit_runner.js`
- 追加 tests: `tests/phase251/*.test.js`

## Out of Scope
- 既存通知 API の変更
- City Pack 判定ロジックの意味変更
- `/internal/jobs/city-pack-source-audit` の認可方式変更

## Design
- Workflow は Cloud Run service URL を解決し、OIDC token で proxy 接続。
- `CITY_PACK_JOB_TOKEN` を header (`x-city-pack-job-token`) で internal job に送る。
- runner は `runId/traceId/mode/targetSourceRefIds` を payload として送信する。
- 失敗時は exit code 非0で終了し、artifact（stdout/stderr）を残す。

## Done Criteria
- `scripts/city_pack_source_audit_runner.js` が CLI と module 双方で利用可能。
- workflow が schedule + workflow_dispatch を持ち runner を実行する。
- `node --test tests/phase251/*.test.js` が PASS。
- `npm test` / `npm run test:docs` が PASS。

## Rollback
- `git revert <phase251 merge commit>`

