# SSOT_NOTIFICATION_COMPOSER_CONTRACT_V1

Notification Composer の状態遷移・入力契約・legacy互換・監査粒度を固定する add-only 仕様。

## 1. State Machine（Composer送信系）

- canonical state: `draft -> active -> planned -> sent`
- `approve` は `draft -> active`
- `plan` は `active|planned -> planned`（再planは許可）
- `execute` は `planned|active -> sent`

### persistence rules

- `notifications.status` に `planned` を保存する
- plan成功時に `notifications` へ以下を保存する
  - `plannedAt`
  - `plannedBy`
  - `lastPlanHash`
  - `lastPlanCount`

## 2. Composer Contract（app shell）

### STEP type payload mapping

- `#targetLimit` -> `payload.target.limit`
- `#targetRegion` -> `payload.target.region`
- `#membersOnly` -> `payload.target.membersOnly`

### non-STEP payload mapping

- `payload.target.limit = 50`（固定）
- `scenarioKey = A`, `stepKey = week`（固定）

### validation

- STEP は `target.limit > 0` を要求する

## 3. Legacy Composer Compatibility

- `/admin/composer` の既定動作は app shell (`/admin/app?pane=composer`) へ redirect
- legacy HTML は削除しない（調査/互換用に保持）
- compat配信は `docs/SSOT_ADMIN_UI_OS.md` の条件（`compat|stay_legacy`, role, confirm token）に従う

## 4. Audit Payload Summary（notifications.*）

### guarantee

- `notifications.send.plan` は `stateFrom/stateTo/planHash/count/limit` と cap系集計を残す
- `notifications.send.execute` は `ok/reason/deliveredCount/skippedCount` と cap系集計を残す
- payloadSummary は token・生URL・本文全文を記録しない

### evidence integration

- trace は `x-trace-id` を優先し、未指定時は route 層で補完する
- decision evidence は `decision_logs` / `decision_timeline` を継続利用する

