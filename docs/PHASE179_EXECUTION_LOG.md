# PHASE179_EXECUTION_LOG

UTC: 2026-02-12T16:20:00Z
branch: `codex/phasec-c13-secret-iam-softfail`
base: `origin/main` @ `ea7ad943df46`

## Track Mapping
- Execution log number: `PHASE179`（全体通番）
- Product track: `Phase C-5`（監査証跡 / 障害解析性の強化）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- 通知運用の主要 route（templates/segment/retry/composer）で、
  500系失敗時に `traceId`/`requestId` をレスポンスへ含める（add-only）。
- 同失敗時に Cloud Run logs へ構造化ログを出す:
  - prefix: `[route_error]`
  - keys: `route`, `name`, `message`, `traceId`, `requestId`, `actor`
- Trace runbook に失敗時の検索手順を追記。

## Code Changes
- `src/routes/admin/osContext.js`
  - `logRouteError(routeId, err, context)` を追加。
  - ログ値を sanitize（空白→`_`）して1行ログへ出力。
- `src/routes/phase61Templates.js`
- `src/routes/phase66Segments.js`
- `src/routes/phase67PlanSend.js`
- `src/routes/phase73RetryQueue.js`
- `src/routes/admin/osNotifications.js`
  - 500ハンドリングで `logRouteError()` を呼び出し。
  - 500レスポンスを `{ ok:false, error:'error', traceId, requestId }` へ拡張（add-only）。

## Test Updates
- `tests/phase179/phase179_route_error_observability.test.js`
  - 対象 route で `logRouteError` 呼び出しと 500 payload 拡張を静的検証。
  - `logRouteError` の出力フォーマット（sanitize含む）を動的検証。

## Docs Updates
- `docs/RUNBOOK_TRACE_AUDIT.md`
  - 500応答時に `[route_error]` を `traceId/requestId` で引く手順を追加。

## Local Verification
- `node --test tests/phase179/phase179_route_error_observability.test.js` PASS
- `npm test` PASS
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS
