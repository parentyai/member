# Data Map

This document describes what data the Member system stores, where it is stored, and how it is used.

## Scope
- App: Member (Cloud Run services: member / member-webhook / member-track)
- Storage: Firestore + Secret Manager + Cloud Logging

## Primary Identifiers
- `lineUserId`: LINE userId (primary key in Member)
- `memberNumber`: user-provided number (not verified by Member)
- `redacMembershipIdHash`: HMAC-SHA256 of user-declared Redac membership id (not reversible without secret)

## Stored Data (Firestore)
### `users/{lineUserId}`
Purpose: user profile + minimal state needed for operations.

Typical fields (not exhaustive):
- `scenarioKey`, `stepKey`: state for scenario/step routing
- `memberNumber`: user-provided number (string|null)
- `createdAt`: created timestamp
- `memberCardAsset`: member card asset reference (object|null)
- `redacMembershipIdHash`: HMAC hash (string|null)
- `redacMembershipIdLast4`: last 4 digits only (string|null)
- `redacMembershipDeclaredAt`, `redacMembershipDeclaredBy`: declaration timestamp + actor (`user`/`ops`)
- `redacMembershipUnlinkedAt`, `redacMembershipUnlinkedBy`: unlink timestamp + actor (`user`/`ops`)

Notes:
- Plaintext Redac membership id is not stored.

### `redac_membership_links/{redacMembershipIdHash}`
Purpose: enforce uniqueness (one Redac membership id can be linked to only one LINE user).

Fields:
- `redacMembershipIdHash`: HMAC hash (doc id and field)
- `redacMembershipIdLast4`: last 4 digits only
- `lineUserId`: linked LINE user
- `linkedAt`, `linkedBy`: link timestamp + actor (`user`/`ops`)

### `audit_logs/{id}`
Purpose: append-only audit trail for sensitive operations and decision traces.

Fields:
- `actor`, `action`, `entityType`, `entityId`
- `traceId`, `requestId`
- `payloadSummary` (should not contain plaintext secrets or full membership ids)
- `createdAt`

### `decision_logs/{id}` / `decision_timeline/{id}` / `ops_states/{lineUserId}`
Purpose: operations decisions, readiness, and state tracking.

### `events/{id}` / `notifications/{id}` / `checklists/*` / `user_checklists/*`
Purpose: product events, notification metadata, and checklist progress.

Typical fields for `notifications/{id}` (add-only excerpts):
- `title`, `body`, `ctaText`, `linkRegistryId`
- `scenarioKey`, `stepKey`, `notificationCategory`
- `target` (`limit` required in send path)
- `status` (`draft`/`active`/`sent`)
- `notificationType` (`GENERAL`/`ANNOUNCEMENT`/`VENDOR`/`AB`/`STEP`)
- `notificationMeta` (type-specific UI metadata; optional)

### `notification_deliveries/{id}`
Purpose: delivery idempotency / reaction tracking / cap evaluation source-of-truth.

Typical fields:
- `notificationId`, `lineUserId`
- `state` (`reserved`/`failed`/`delivered`/`sealed`)
- `delivered` (boolean)
- `sentAt` (timestamp|string|null)
- `deliveredAt` (timestamp|string|null, cap evaluation primary time)
- `readAt`, `clickAt`, `lastError`, `lastErrorAt`
- `sealed`, `sealedAt`, `sealedBy`, `sealedReason`
- `deliveredAtBackfilledAt`, `deliveredAtBackfilledBy` (manual backfill evidence)

### `city_packs/{id}`
Purpose: City Pack の宣言型配信ロジック束。

Typical fields:
- `name`
- `status` (`draft`/`active`/`retired`)
- `sourceRefs[]`
- `validUntil`
- `allowedIntents` (固定: `CITY_PACK`)
- `rules[]`
- `targetingRules[]`（Rule Pack）
- `slots[]`（Slot-based Pack）
- `slotContents`（固定8スロット体験マップ）
- `slotSchemaVersion`（例: `v1_fixed_8_slots`）
- `basePackId`（1段のみ継承）
- `overrides`（継承上書き）
- `packClass` (`regional`/`nationwide`)
- `language`（既定 `ja`）
- `nationwidePolicy`（`packClass=nationwide` のとき `federal_only`）

### `city_pack_requests/{requestId}`
Purpose: City Pack 生成リクエストの状態機械（LINE申告→草案→承認→有効化）。

Typical fields:
- `status` (`queued`/`collecting`/`drafted`/`needs_review`/`approved`/`active`/`rejected`/`failed`)
- `lineUserId`
- `regionCity`, `regionState`, `regionKey`
- `requestClass` (`regional`/`nationwide`)
- `requestedLanguage`（既定 `ja`）
- `requestedAt`
- `lastJobRunId`
- `traceId`
- `draftCityPackIds[]`
- `draftTemplateIds[]`
- `draftSourceRefIds[]`
- `draftLinkRegistryIds[]`
- `experienceStage`
- `lastReviewAt`
- `error`

### `city_pack_feedback/{id}`
Purpose: City Packの誤り報告（LINE→admin review）。

Typical fields:
- `status` (`queued`/`reviewed`/`rejected`/`proposed`/`new`/`triaged`/`resolved`)
- `lineUserId`
- `regionCity`, `regionState`, `regionKey`
- `packClass` (`regional`/`nationwide`)
- `language`（既定 `ja`）
- `feedbackText`
- `message`
- `slotKey`
- `resolution`
- `resolvedAt`
- `traceId`
- `requestId`

### `source_refs/{id}`
Purpose: City Pack が参照する情報源の監査状態管理。

Typical fields:
- `url`
- `status` (`active`/`needs_review`/`dead`/`blocked`/`retired`)
- `validFrom`, `validUntil`
- `lastResult`, `lastCheckAt`
- `contentHash`
- `riskLevel`
- `sourceType` (`official`/`semi_official`/`community`/`other`)
- `requiredLevel` (`required`/`optional`)
- `authorityLevel` (`federal`/`state`/`local`/`other`)
- `confidenceScore`（0..100）
- `lastAuditStage` (`light`/`heavy`)
- `evidenceLatestId`
- `usedByCityPackIds[]`

### `source_evidence/{id}`
Purpose: 情報源監査の証跡（append-only）。

Typical fields:
- `sourceRefId`
- `checkedAt`
- `result`
- `statusCode`
- `finalUrl`
- `contentHash`
- `screenshotPaths[]`
- `diffSummary`
- `traceId`
- `llm_used`, `model`, `promptVersion`

### `source_audit_runs/{runId}`
Purpose: 監査ジョブ実行の run 単位サマリ（冪等管理）。

Typical fields:
- `runId`, `mode`
- `stage` (`light`/`heavy`)
- `startedAt`, `endedAt`
- `processed`, `succeeded`, `failed`
- `failureTop3[]`
- `confidenceSummary` (`average`/`min`/`max`)
- `traceId`
- `targetSourceRefIds[]`

### `city_pack_metrics_daily/{id}`
Purpose: City Pack効果測定（pack/slot/sourceRef単位の日次集計）。

Typical fields:
- `dateKey` (`YYYY-MM-DD`)
- `cityPackId`
- `slotId`
- `sourceRefId`
- `sentCount`, `deliveredCount`, `clickCount`, `readCount`, `failedCount`
- `ctr`
- `traceId`
- `lastComputedAt`, `updatedAt`

### `city_pack_template_library/{id}`
Purpose: City Pack import/exportで再利用するテンプレライブラリ。

Typical fields:
- `status` (`draft`/`active`/`retired`)
- `name`
- `schemaVersion`
- `template`（`city_pack_template_v1` のJSON）
- `source` (`manual` など)
- `traceId`, `requestId`
- `createdAt`, `updatedAt`, `activatedAt`, `retiredAt`

### `ops_read_model_snapshots/{snapshotType__snapshotKey}`
Purpose: Ops KPI/summary の snapshot read-model（full scanの常用回避）。

Typical fields:
- `snapshotType`（`dashboard_kpi` / `user_operational_summary` / `user_state_summary`）
- `snapshotKey`（`1|3|6|12` や `latest` / `lineUserId`）
- `asOf`
- `freshnessMinutes`
- `sourceTraceId`
- `data`
- `createdAt`, `updatedAt`

### Planned Add-only (City Pack extensions 1-12, inactive until phase enable)
Purpose: 実装フェーズ分割時の互換契約を固定するための予定スキーマ。実装完了までは必須扱いにしない。

#### Planned fields in `city_packs/{id}`
- `targetingRules[]`: Rule Pack（targeting宣言）
- `slots[]`: Slot-based Pack定義
- `basePackId`: 継承元（1段のみ）
- `overrides`: 継承上書き

#### Planned fields in `source_refs/{id}`
- `sourceType`: 情報源種別
- `requiredLevel`: `required|optional`
- `authorityLevel`: `federal|state|local|other`
- `confidenceScore`: 信頼度スコア（0..100）
- `lastAuditStage`: `light|heavy`

#### Planned collections
- `city_pack_feedback/{id}`: ユーザー誤り報告導線
- `city_pack_bulletins/{id}`: Change Bulletin（draft/approved/sent）
- `city_pack_update_proposals/{id}`: 更新提案（適用は人間）
- `city_pack_metrics_daily/{id}`: pack/slot/sourceRef単位の集計
- `city_pack_template_library/{id}`: import/export用テンプレライブラリ

#### Planned fields in `city_pack_bulletins/{id}`
- `status`: `draft|approved|sent|rejected`
- `cityPackId` (required)
- `notificationId` (required)
- `summary` (required)
- `traceId` (required)
- `requestId` (optional)
- `approvedAt` / `sentAt`
- `deliveredCount`
- `llm_used` / `model` / `promptVersion` (optional)

#### Planned fields in `city_pack_update_proposals/{id}`
- `status`: `draft|approved|rejected|applied`
- `cityPackId` (required)
- `summary` (required)
- `proposalPatch` (allowlist apply)
- `traceId` (required)
- `requestId` (optional)
- `approvedAt` / `appliedAt`
- `llm_used` / `model` / `promptVersion` (optional)

## Secrets (Secret Manager)
Purpose: store secrets used by the system and CI deploy workflows.

Examples (stg):
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `ADMIN_OS_TOKEN`
- `TRACK_TOKEN_SECRET`
- `REDAC_MEMBERSHIP_ID_HMAC_SECRET`

## Logs
### Cloud Logging
Purpose: operational logs for debugging and incident response.

Notes:
- Logs should not include plaintext secrets or full membership ids.

## Data Access & Authorization
- Cloud Run IAM controls who can invoke private services.
- App-layer admin token (`ADMIN_OS_TOKEN`) additionally protects `/admin/*` and `/api/admin/*`.
- Public services (`member-webhook`, `member-track`) accept only their service-mode endpoints.

## Retention & Deletion
- The codebase does not implement automatic TTL deletion for Firestore collections.
- Retention is therefore effectively indefinite unless GCP-level retention policies are configured separately.

### Governance Cadence (recommended)
- Weekly:
  - check `audit_logs` / `notification_deliveries` growth trend
  - verify no plaintext secrets or full membership ids appear in sampled logs
- Monthly:
  - review retention settings for Firestore / Logging / Secret Manager
  - verify deletion/archival run evidence exists
- On incident/request:
  - run scoped deletion procedure and capture approval + execution evidence

### Operational Responsibility Split
- Application responsibility:
  - avoid storing plaintext secrets and full Redac membership ids
  - append audit logs with traceId/requestId for sensitive operations
  - provide manual recovery and administrative controls via `/api/admin/*`
- Infrastructure responsibility:
  - define and enforce retention/backup/deletion policies in GCP (Firestore/Logging/Secret Manager)
  - maintain IAM least-privilege and service account boundaries between environments
  - maintain WIF/OIDC trust policy for CI deploy identities
- Compliance/legal responsibility:
  - approve retention/deletion policy changes before rollout
  - keep policy decision records and approval dates

### Minimum Deletion Runbook Inputs (for legal/ops review)
- Which collection(s) or log sink(s) are in scope
- Reason for deletion (request/incident/policy)
- Approval record (who approved, when)
- Execution evidence (traceId, command/run URL, resulting counts)

### Minimum Deletion Evidence Outputs (fixed)
- ticket_or_request_id
- approver
- approved_at (UTC)
- executed_by
- executed_at (UTC)
- scope_summary (collections/sinks)
- before_count / after_count
- verification_command_and_result
- rollback_or_restore_plan

## Phase662 Add-only Collections

### journey_graph_change_logs
Purpose: Journey Graph Catalog の plan/set 設定履歴を監査保存する。  
Typical fields:
- `actor`, `traceId`, `requestId`
- `planHash`
- `catalog`（適用時スナップショット）
- `summary`（enabled/schemaVersion/nodeCount/edgeCount）
- `createdAt`, `updatedAt`

### journey_todo_items（add-only fields）
- `journeyState`
- `phaseKey`, `domainKey`, `planTier`
- `snoozeUntil`, `lastSignal`
- `stateEvidenceRef`, `stateUpdatedAt`

Notes:
- 既存 `status=open|completed|skipped` の意味は変更しない。
