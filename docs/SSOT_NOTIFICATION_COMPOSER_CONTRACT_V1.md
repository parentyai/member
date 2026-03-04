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

## 9. Composer Layout V2 Contract（add-only）

- 対象画面: `/admin/app?pane=composer`
- レイアウトを以下で固定する:
  - 上段（全幅）: `ライブプレビュー`
  - 下段（2カラム）: 左=`通知作成`（コンパクト） / 右=`通知一覧`
  - モバイルは縦積み（`ライブプレビュー -> 通知作成 -> 通知一覧`）
- プレビュー端末サイズは `360x160` 固定（ブラウザ幅変更で拡縮しない）。
- 既存アクションIDは維持し、主導線は `下書き作成` / `承認（有効化）` とする。
- `preview/plan/execute` は API互換のためID/処理を残すが、既定UIでは非主導線とする。

### 通知タイプUI

- Composer の `notificationType` 選択肢は `GENERAL / ANNOUNCEMENT / VENDOR / STEP` を表示対象とする。
- `AB` は API互換を維持しつつ、Composer入力UIの選択肢からは除外する。

## 10. Notification Archive Contract（add-only）

- 新規API:
  - `POST /api/admin/os/notifications/archive`
  - 入力: `notificationIds[]`, `reason?`
  - 動作: 物理削除は行わず `archivedAt/archivedBy/archiveReason` を更新する。
- 一覧API拡張:
  - `GET /api/admin/os/notifications/list` に `includeArchived=1` を追加。
  - 既定（未指定/`0`）は archive 済み通知を除外する。
- 通知一覧UIの「削除」は archive（非破壊非表示）を意味する。

## 11. Composer Layout V2.1 Compact Preview（add-only）

- 配置を以下に更新する:
  - 左上: `ライブプレビュー`
  - 右上: `通知一覧`
  - 左下: `通知作成`
- 既存IDは維持し、`#composer-saved-panel` はライブプレビュー右側に表示する。
- プレビュー端末サイズは `360x160` に縮小する（縦1/4運用）。
- モバイルは `ライブプレビュー -> 通知作成 -> 通知一覧` の順で縦積みを維持する。

## 12. CTA Multi + AB Option V1（add-only）

- `ENABLE_NOTIFICATION_CTA_MULTI_V1`（既定 `0`）:
  - `1` の場合、Composer payload は `secondaryCtas[]`（最大2件）を追加できる。
  - 合計CTAは `primary(=ctaText+linkRegistryId) + secondary<=2`、合計 `<=3`。
  - `secondaryCtas[]` の各要素は `ctaText + linkRegistryId` を必須とし、片側のみ入力は reject する。
  - ラベル制約: 1..20文字、改行不可、重複不可（大小無視）。
  - `0` の場合、`secondaryCtas[]` は受理しない（既存単一CTA契約を維持）。

- `ENABLE_LINE_CTA_BUTTONS_V1`（既定 `0`）:
  - `1` の場合、通知送信は LINE `Template Buttons` を優先する。
  - 安全条件不成立時は既存 `text` 送信へフォールバックする（add-only互換）。

- `ENABLE_COMPOSER_AB_OPTION_V1`（既定 `0`）:
  - `1` の場合、Composerの `notificationType` 選択肢に `AB` を表示する。
  - `0` の場合、既存どおりAB選択肢を非表示にする。

- 互換固定:
  - `ctaText2` は従来どおりプレビュー専用で、保存・送信payloadには接続しない。
