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

### 運用導線（誰が/いつ/何のために）

- 誰が: `admin` / `developer` のみ
- いつ: route互換検証・障害調査・差分監査が必要な時のみ
- 何のために: legacy表示とapp pane表示の差分証跡を採取するため
- 通常運用: `app pane` を唯一の既定導線とする（迷ったら `/admin/app?pane=composer`）

## 4. Audit Payload Summary（notifications.*）

### guarantee

- `notifications.send.plan` は `stateFrom/stateTo/planHash/count/limit` と cap系集計を残す
- `notifications.send.execute` は `ok/reason/deliveredCount/skippedCount` と cap系集計を残す
- payloadSummary は token・生URL・本文全文を記録しない

### payloadSummary 固定キー（add-only）

- `notifications.create`
  - `notificationType`
  - `notificationCategory`
  - `scenarioKey`
  - `stepKey`
  - `linkRegistryId`
  - `targetLimit`
  - `targetRegionSet`
  - `targetMembersOnly`
  - `titleLength`
  - `bodyLength`
  - `ctaLength`
- `notifications.preview`
  - `notifications.create` の全キー
  - `trackEnabled`
- `notifications.send.plan`
  - `notificationId`
  - `stateFrom`
  - `stateTo`
  - `planHash`
  - `count`
  - `limit`
  - `notificationCategory`
  - `capBlockedCount`
  - `capCountMode`
  - `capCountSource`
  - `capCountStrategy`
  - `capBlockedSummary`
- `notifications.send.execute`
  - `ok`
  - `reason`
  - `deliveredCount`
  - `skippedCount`
  - `capBlockedCount`
  - `capBlockedSummary`
  - `capCountMode`
  - `capCountSource`
  - `capCountStrategy`
  - `notificationCategory`

### マスク規則

- payloadSummary へ以下を記録しない
  - `confirmToken` / 認可token
  - 生URL（http/https文字列）
  - 本文全文 / CTA全文
- 文字列は原則 `ID` と `状態` のみ。本文系は `Length` で保存する。
- `planHash` は確認照合に必要なため保存可。

### 例外条件（緊急時）

- 緊急時でも payloadSummary の禁止項目は記録しない。
- 追加証跡が必要な場合は `traceId` を軸に `decision_logs` / `decision_timeline` / 運用チケットへ分離して残す。
- route error は `route_error` 監査へ `name/message(route-safe)` のみ記録し、本文・tokenは残さない。

### evidence integration

- trace は `x-trace-id` を優先し、未指定時は route 層で補完する
- decision evidence は `decision_logs` / `decision_timeline` を継続利用する
