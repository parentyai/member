# RUNBOOK_TRACE_AUDIT

## Purpose
traceId 1本で「閲覧→判断→（実行試行）→監査bundle」を再現できることを、コマンド駆動で確認する。

## Preconditions (ENV)
- Node.js 20+
- `SERVICE_MODE` は未指定（member）でOK（ローカルでは in-memory stub DB を使用）
- CI では `npm test` に加えて `npm run test:trace-smoke` が実行される（Phase136）

## Steps
1) Unit tests
```sh
npm test
```

2) Trace smoke (script)
```sh
npm run test:trace-smoke
```

## Expected Output (Pass/Fail)
- `npm test`: fail 0
- `npm run test:trace-smoke`: exit code 0
  - stdout JSON に `traceId`, `counts`, `sample` が含まれる
  - `sample.auditActions` に `ops_console.view` / `ops_decision.submit`
  - `sample.timelineActions` に `EXECUTE`（実行試行が timeline に残る）

## Firestore SSOT Observation Points (by API)
Firestore を直叩きせず、API で bundle を確認する：
- `GET /api/admin/trace?traceId=...`
  - response: `{ traceId, audits:[], decisions:[], timeline:[] }`

## Failure Patterns
- `TRACE_SMOKE_PORT required ...`:
  - `TRACE_SMOKE_NO_START_SERVER=1` が有効になっている。解除する。
- `LINE_CHANNEL_ACCESS_TOKEN required`:
  - trace smoke が送信副作用を踏んでいる疑い（P0）。Phase132 の kill switch / NO_ACTION 経路を確認。

## Rollback / Safety
- Kill Switch を ON にして送信副作用を止める（Phase0）
- 回帰が入った場合:
  - 実装PRを `revert`
  - docs-only PRを `revert`

