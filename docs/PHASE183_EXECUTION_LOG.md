# PHASE183_EXECUTION_LOG

UTC: 2026-02-12T21:25:00Z
branch: `codex/phasec-c18-stg-e2e-strict-route-error`
base: `origin/main` @ `1a98b9c`

## Track Mapping
- Execution log number: `PHASE183`（全体通番）
- Product track: `Phase C-5`（stg実測証跡の検知強化）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- stg notification E2E runner に strict route_error gate を追加。
- `--fail-on-route-errors` 指定時、`route_error` ログが1件でも見つかったシナリオを FAIL にする。
- runbook に strict mode 運用を追記。

## Code Changes
- `tools/run_stg_notification_e2e_checklist.js`
  - 新オプション: `--fail-on-route-errors` / `E2E_FAIL_ON_ROUTE_ERRORS=1`
  - strict mode 時は `fetch-route-errors` を暗黙有効化
  - strict gate 判定 `applyRouteErrorStrictGate()` を追加
  - summary に `strictRouteErrors` / `routeErrorFailures` を追加
- `tests/phase183/phase183_stg_e2e_strict_route_error_gate.test.js`
  - parseArgs と strict gate 判定を検証
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md`
  - 推奨コマンドへ `--fail-on-route-errors` を追加
  - Optional Inputs に strict gate を追記

## Local Verification
- `node --test tests/phase171/phase171_stg_e2e_runner_helpers.test.js` PASS
- `node --test tests/phase180/phase180_stg_e2e_route_error_capture.test.js` PASS
- `node --test tests/phase183/phase183_stg_e2e_strict_route_error_gate.test.js` PASS
- `npm test` PASS
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS

## Rollback
- 本PRを revert し、strict route_error gate オプションを削除して従来の証跡収集のみへ戻す。
