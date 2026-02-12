# PHASE180_EXECUTION_LOG

UTC: 2026-02-12T16:30:00Z
branch: `codex/phasec-c15-stg-e2e-route-error-capture`
base: `origin/main` @ `501e9d50fe3b`

## Track Mapping
- Execution log number: `PHASE180`（全体通番）
- Product track: `Phase C-5`（stg実測証跡の障害解析性強化）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- `ops:stg-e2e` 実行時、シナリオ失敗（FAIL）に対して
  Cloud Logging の `[route_error]` を traceId で回収できるオプションを追加。
- レポート（JSON/Markdown/console）に `route_error` 回収結果を出力し、
  失敗理由の一次特定をその場で可能にする。

## Code Changes
- `tools/run_stg_notification_e2e_checklist.js`
  - 新オプション:
    - `--fetch-route-errors`
    - `--project-id <GCP_PROJECT_ID>`
    - `--route-error-limit <1-200>`
  - 新処理:
    - `buildRouteErrorLoggingFilter(traceId)`
    - `fetchRouteErrors(ctx, traceId)`（`gcloud logging read`）
  - シナリオ結果に `routeErrors` を add-only 追加（FAIL時）
  - summary に `routeErrorFetchEnabled` を add-only 追加
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md`
  - 推奨コマンドへ `--fetch-route-errors --project-id` を追記
  - Optional Inputs に route_error 回収の説明を追記

## Test Updates
- `tests/phase180/phase180_stg_e2e_route_error_capture.test.js`
  - parseArgs の新オプション
  - projectId 必須ガード
  - route_error filter 生成
  - route_error 回収結果のパース
  - Markdown summary 反映

## Local Verification
- `node --test tests/phase180/phase180_stg_e2e_route_error_capture.test.js` PASS
- `node --test tests/phase171/phase171_stg_e2e_runner_helpers.test.js` PASS
- `npm test` PASS
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS
