# SSOT_LINE_RICH_MENU

Member の LINE Rich Menu を「ジャーニーOS常設UI」として固定する add-only SSOT。
既存 `journeyPolicy.rich_menu_map` は互換フォールバックとして維持し、本書で定義する専用レイヤを優先する。

## Scope
- `/api/admin/os/rich-menu/*` の運用契約
- `rich_menu_templates / rich_menu_phase_profiles / rich_menu_assignment_rules / rich_menu_rollout_runs / rich_menu_rate_buckets / opsConfig.richMenuPolicy` のデータ契約
- `applyPersonalizedRichMenu` の新resolver接続と互換経路
- `/admin/app?pane=monitor` の Rich Menu 運用UI

## Non-Goals
- 既存 `journeyPolicy` の意味変更
- Firestore既存フィールドの意味変更
- 英語運用（`locale=en`）の本番展開
- householdType粒度の最適化

## Feature Flags / Guards
- `ENABLE_RICH_MENU_DYNAMIC`（既存）:
  - `0|false|off` で Rich Menu動的切替を停止
- `opsConfig/richMenuPolicy.enabled`:
  - Rich Menu運用レイヤ全体の有効/無効
- `opsConfig/richMenuPolicy.updateEnabled`:
  - Rich Menu更新（link/unlink/default変更）専用 kill switch
- `system_flags.killSwitch`（既存）:
  - LINE副作用全体の最終停止装置

## Data Contract

### 1) Template
Collection: `rich_menu_templates/{templateId}`

Required fields:
- `templateId` (stable ID)
- `kind`: `default|phase|plan|combined`
- `target`:
  - `planTier`: `free|paid|null`
  - `phaseId`: `pre_departure|arrival|launch|stabilize|repatriation|null`
  - `locale`: `ja|en`
- `layout`:
  - `size`: `large|small`
  - `areas[]`:
    - `label`
    - `bounds`: `{x,y,width,height}`
    - `actionType`: `uri|message|postback`
    - `actionPayload`
- `status`: `draft|active|deprecated`
- `lineMeta`:
  - `richMenuId`
  - `aliasId`
  - `imageAssetPath`
- `version`
- `createdAt/createdBy`, `updatedAt/updatedBy`

Safety:
- `areas.length` は `1..6`
- `actionType=uri` は直URL禁止（`http(s)://` payload を拒否）
- 画像uploadは admin payload ではなく CLI 経由で実施

### 2) Phase Profile
Collection: `rich_menu_phase_profiles/{phaseId}`

Required fields:
- `phaseId`: `pre_departure|arrival|launch|stabilize|repatriation`
- `status`: `active|deprecated`
- `journeyStageMatchers[]`
- `label`, `description`

### 3) Assignment Rule
Collection: `rich_menu_assignment_rules/{ruleId}`

Required fields:
- `ruleId`
- `kind`: `default|phase|plan|combined`
- `status`: `draft|active|deprecated`
- `templateId`
- `priority`
- `target` (`planTier|phaseId|locale`)

### 4) Binding (existing extension)
Collection: `rich_menu_bindings/{lineUserId}`

Add-only fields:
- `currentTemplateId`
- `previousTemplateId`
- `resolvedRuleId`
- `planTier`
- `phaseId`
- `lastApplyResult`
- `lastTraceId`
- `nextEligibleAt`
- `manualOverrideTemplateId`

Legacy互換:
- `currentMenuKey`, `currentRichMenuId`, `appliedAt`, `lastError`, `updatedAt` は維持

### 5) Policy
Document: `opsConfig/richMenuPolicy`

Fields:
- `enabled`
- `updateEnabled`
- `defaultTemplateId`
- `fallbackTemplateId`
- `cooldownSeconds` (default `21600`)
- `maxAppliesPerMinute` (default `60`)
- `maxTargetsPerApply` (default `200`)
- `allowLegacyJourneyPolicyFallback` (default `true`)

### 6) Rate Bucket
Collection: `rich_menu_rate_buckets/{yyyyMMddHHmm}`

Fields:
- `bucketId`
- `count`
- `maxCount`
- `lastActor`
- `lastTraceId`
- `createdAt`, `updatedAt`

### 7) Rollout Run
Collection: `rich_menu_rollout_runs/{runId}`

Fields:
- `action`: `apply|rollback`
- `mode`: `dry_run|apply|rollback`
- `actor`, `traceId`, `requestId`
- `lineUserIds[]`
- `summary`
- `results[]`
- `createdAt`, `updatedAt`

## Resolver Contract

Priority (fixed):
1. per-user override (`manualOverrideTemplateId`)
2. `plan+phase` rule
3. `plan` rule
4. `phase` rule
5. `defaultTemplateId`
6. legacy fallback (`journeyPolicy.rich_menu_map`) when `allowLegacyJourneyPolicyFallback=true`

Locale:
- 現行最小実装は `ja` を既定とする

Plan normalization:
- subscription の `pro` は `paid` として扱う

Phase resolution:
- `phaseId` 明示指定がなければ `journeyStage` を `rich_menu_phase_profiles` で写像する

## Admin API Contract

### Status
- `GET /api/admin/os/rich-menu/status`
- 返却:
  - `policy`
  - `templates[]`
  - `rules[]`
  - `phaseProfiles[]`
  - `runs[]`
  - `globalKillSwitch`

### Plan
- `POST /api/admin/os/rich-menu/plan`
- 入力:
  - `action`
  - `payload`
- 返却:
  - 正規化済 `payload`
  - `planHash`
  - `confirmToken`

### Set
- `POST /api/admin/os/rich-menu/set`
- 入力:
  - `action`
  - `payload`
  - `planHash`
  - `confirmToken`
- ガード:
  - `plan_hash_mismatch` -> `409`
  - `confirm_token_mismatch` -> `409`

### History
- `GET /api/admin/os/rich-menu/history?limit=20`

### Resolve Preview
- `POST /api/admin/os/rich-menu/resolve-preview`
- 入力:
  - `lineUserId` required
  - optional `planTier`, `journeyStage`, `phaseId`, `householdType`, `locale`
- 返却:
  - resolve context
  - resolved source/template/richMenuId

## Admin Operation Actions
- `set_policy`
- `upsert_template`
- `upsert_phase_profile`
- `upsert_rule`
- `set_manual_override`
- `clear_manual_override`
- `apply`
- `rollback`

`apply` / `rollback` payload:
- `lineUserIds[]` required
- `dryRun` optional
- `planTier|journeyStage|phaseId|householdType|locale` optional

## UX Contract (/admin/app monitor)
- テンプレ一覧（templateId/kind/status/target/richMenuId）
- 現在ポリシー概要（enabled/updateEnabled/cooldown/maxApplies/global kill）
- resolve preview（対象ユーザー）
- plan/set（二段階）
- history（run evidence）
- rollback は `action=rollback` で同一導線

## Audit Contract
- `audit_logs.action` add-only:
  - `rich_menu.status.view`
  - `rich_menu.history.view`
  - `rich_menu.resolve_preview`
  - `rich_menu.plan`
  - `rich_menu.set`
- 必須項目:
  - `traceId`, `requestId`, `actor`, `payloadSummary`

## Rollout Playbook (stg first)
1. template/rule/policy を `draft` で投入
2. `resolve-preview` で対象検証
3. `plan` 実行で hash/token 固定
4. `set` with `dryRun=true`
5. 限定ユーザーで `apply`
6. `history` + `audit_logs` で trace 検証
7. 問題時は `rollback` または `updateEnabled=false`

## Rollback
- 即時停止:
  - `set_policy` で `updateEnabled=false`
- 段階巻き戻し:
  - `rollback` action で `previousTemplateId` に戻す
- 完全巻き戻し:
  - PR revert（コード/SSOT/UI差分）

