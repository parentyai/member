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

## 2.1 Category Wizard Contract（add-only, Phase676）

- `ENABLE_COMPOSER_CATEGORY_WIZARD_V1`（既定 `0`）でカテゴリ導線UIを段階導入する。
- `1` のとき、`/admin/app?pane=composer` は以下を満たす。
  - `COMPOSER_CATEGORY_FLOW_DEFS` に基づきカテゴリ別ガイドを表示する。
  - 操作導線は `下書き -> 承認 -> 送信計画 -> 送信実行` を同一アクション帯で表示する。
  - 既存ボタンID（`create-draft`,`approve`,`plan`,`execute`）は維持する。
  - `composerDraftByType` により type切替時の入力を復元できる。
  - `composerActionGateState` によりボタン有効条件を可視化する。
- `0` のとき、既存導線を維持する（後方互換）。

### saved list status normalization（add-only）

- 状態フィルタは `approved` 1項目で `approved|active` の両方を対象にする。
- 一覧表示の状態ラベルは `下書き/承認済み/計画済み/実行済み` の辞書表示に統一する。

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

## 5. Scenario×Step Matrix Contract（add-only）

- 表示主軸は `Scenario × Step × Notification` とする。
- 行キーは `scenarioKey × stepKey`（`PHASE0_SCENARIOS` / `STEP_ORDER`）を使う。
- セル内の通知実体表示は以下を含む:
  - `notificationId`
  - `title`
  - `type`（`notificationType`）
  - `status`
  - `target(region/limit/membersOnly)`
  - `planHash`（`lastPlanHash`）
  - `lastExecution`（`read-model.lastSentAt`）
  - `result`（`read-model.notificationHealth/reactionSummary`）
  - `actions`（`draft/preview/approve/plan/execute` の可否）
- `actions` 可否は状態 + ガード契約を表示専用で示す:
  - `draft/preview`: 常時可
  - `approve`: `draft` のみ
  - `plan`: `approved|planned` のみ
  - `execute`: `approved|planned` かつ `planHash` あり
  - ガード注記は `x-actor + x-trace-id`、`execute` は `planHash + confirmToken` を併記
- `trigger` / `order` は以下を canonical とする（add-only）:
  - `trigger`: `manual` 固定（Composer起点）
  - `order`: `STEP_ORDER`（`3mo,2mo,1mo,week,after1w,after1mo`）の 1-based index
  - 既存通知で `order` 欠落時は `stepKey` から同規則で補完表示する
  - 入力値が規約外なら server は reject（`trigger invalid` / `order invalid`）

## 6. VENDOR vendorId Contract（add-only）

- `notificationType=VENDOR` の場合は `notificationMeta.vendorId` を server 側で必須とする。
- 欠落時は `422` で reject し、`notificationMeta.vendorId required` を返す。

## 7. CTA2 Contract（add-only）

- `ctaText2` はプレビュー専用入力。
- `payload` / 永続化 / 送信には接続しない。
- UIは「保存・送信には使われない」ことを常時明示する。

## 8. Audit checkedAt Contract（add-only）

- 通知系監査（`notifications.create` / `notifications.preview` / `notifications.approve` / `notifications.send.plan` / `notifications.send.execute`）の `payloadSummary` に `checkedAt` を追加する。
- 形式は ISO8601 文字列を推奨し、既存キーは不変（add-only）とする。
