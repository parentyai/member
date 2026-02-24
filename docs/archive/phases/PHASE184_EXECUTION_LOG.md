# PHASE184_EXECUTION_LOG

UTC: 2026-02-12T21:55:00Z
branch: `codex/phasec-c19-stg-e2e-workflow`
base: `origin/main` @ `4d6cc95`

## Track Mapping
- Execution log number: `PHASE184`（全体通番）
- Product track: `Phase C-5`（stg実測証跡の実行経路固定）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- stg notification E2E checklist を GitHub Actions `workflow_dispatch` から実行可能にする。
- Cloud Run proxy + strict route_error gate (`--fail-on-route-errors`) を workflow に固定。
- artifact に JSON/Markdown を必ず残す。

## Code Changes
- `.github/workflows/stg-notification-e2e.yml`（新規）
  - 入力: `segment_template_key`, `composer_notification_id`, `retry_queue_id`, `actor`, `route_error_limit`
  - OIDC auth + gcloud setup
  - Secret Manager から `ADMIN_OS_TOKEN` 読み出し
  - `gcloud run services proxy` 経由で `npm run ops:stg-e2e` を実行
  - `--fetch-route-errors --fail-on-route-errors` を固定
  - artifacts upload + job summary 追記
- `tests/phase184/phase184_stg_e2e_workflow_exists.test.js`（新規）
  - workflow 定義、strict route_error オプション、artifact upload を静的検証
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md`
  - `gh workflow run stg-notification-e2e.yml` の手順を追記

## Local Verification
- `node --test tests/phase171/phase171_stg_e2e_runner_helpers.test.js` PASS
- `node --test tests/phase180/phase180_stg_e2e_route_error_capture.test.js` PASS
- `node --test tests/phase183/phase183_stg_e2e_strict_route_error_gate.test.js` PASS
- `node --test tests/phase184/phase184_stg_e2e_workflow_exists.test.js` PASS
- `npm test` PASS
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS

## Rollback
- 本PRを revert し、`stg-notification-e2e.yml` と Phase184関連ドキュメント/テストを削除して従来運用へ戻す。
