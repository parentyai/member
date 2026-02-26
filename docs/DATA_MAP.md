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

### `link_registry/{id}`（教育 add-only field）
Purpose: 通知/City Packが参照するリンク辞書。教育用途では公立学校公式リンクを管理する。

Typical fields (education add-only):
- `domainClass` (`gov`/`k12_district`/`school_public`/`unknown`)
- `schoolType` (`public`/`private`/`unknown`)
- `eduScope` (`calendar`/`district_info`/`enrollment`/`closure_alert`)
- `regionKey`
- `tags[]`（例: `education`,`calendar`,`public`）

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
- `domainClass` (`gov`/`k12_district`/`school_public`/`unknown`)
- `schoolType` (`public`/`private`/`unknown`)
- `eduScope` (`calendar`/`district_info`/`enrollment`/`closure_alert`)
- `regionKey`
- `evidenceLatestId`
- `usedByCityPackIds[]`

### `municipality_schools/{id}`
Purpose: 自治体単位の公立学校インポート結果（NCES CCD など）。

Typical fields:
- `regionKey`
- `name`
- `type`（固定: `public`）
- `district`
- `sourceLinkRegistryId`
- `sourceUrl`
- `lastFetchedAt`
- `traceId`
- `createdAt`, `updatedAt`

### `school_calendar_links/{id}`
Purpose: 公立学校カレンダーの参照リンク管理（本文非保持）。

Typical fields:
- `regionKey`
- `linkRegistryId`
- `sourceRefId`
- `schoolYear`
- `status` (`active`/`archived`)
- `validUntil`
- `traceId`
- `createdAt`, `updatedAt`

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

### `emergency_providers/{providerKey}`
Purpose: Emergency provider の有効/無効と取得頻度を管理する。

Typical fields:
- `providerKey`（`nws_alerts` / `usgs_earthquakes` / `fema_ipaws` / `openfema_declarations` / `openfda_recalls` / `airnow_aqi`）
- `status` (`enabled`/`disabled`)
- `scheduleMinutes`
- `officialLinkRegistryId`
- `lastRunAt`, `lastSuccessAt`, `lastError`
- `lastPayloadHash`, `lastEtag`, `lastModified`
- `traceId`
- `createdAt`, `updatedAt`

### `emergency_snapshots/{snapshotId}`
Purpose: provider取得結果の証跡（raw/要約/ハッシュ）を保持する。

Typical fields:
- `providerKey`
- `fetchedAt`
- `statusCode`
- `etag`, `lastModified`
- `payloadHash`
- `payloadPath`（必要時）
- `payloadSummary`
- `rawPayload`（サイズ上限内）
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_events_normalized/{eventDocId}`
Purpose: provider差異を吸収した正規化イベントを保持する。

Typical fields:
- `providerKey`
- `eventKey`
- `regionKey`
- `severity` (`INFO`/`WARN`/`CRITICAL`)
- `category` (`weather`/`earthquake`/`alert`/`recall`/`air`)
- `headline`
- `startsAt`, `endsAt`
- `officialLinkRegistryId`
- `snapshotId`
- `eventHash`
- `isActive`, `resolvedAt`
- `rawMeta`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_diffs/{diffId}`
Purpose: normalized event の差分（new/update/resolve）を保存する。

Typical fields:
- `providerKey`
- `regionKey`
- `category`
- `diffType` (`new`/`update`/`resolve`)
- `severity`
- `changedKeys[]`
- `summaryDraft`
- `snapshotId`
- `eventKey`, `eventDocId`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_bulletins/{bulletinId}`
Purpose: 通知候補（draft→approved→sent/rejected）を管理する。

Typical fields:
- `status` (`draft`/`approved`/`sent`/`rejected`)
- `providerKey`
- `regionKey`
- `category`
- `severity`
- `headline`
- `linkRegistryId`
- `messageDraft`
- `evidenceRefs`（`snapshotId` / `diffId` / `eventDocId`）
- `approvedBy`, `approvedAt`
- `sentAt`
- `notificationIds[]`
- `sendResult`
- `traceId`
- `createdAt`, `updatedAt`

### `emergency_unmapped_events/{id}`
Purpose: region解決できなかったイベントを監査隔離する。

Typical fields:
- `providerKey`
- `eventKey`
- `reason`
- `snapshotId`
- `rawMeta`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

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
- `dependencyReasonMap`

Notes:
- 既存 `status=open|completed|skipped` の意味は変更しない。

### journey_branch_queue
Purpose: reaction branch の dispatch 対象を非同期処理する運用キュー（add-only）。  
Typical fields:
- `lineUserId`
- `deliveryId`
- `todoKey`
- `action`
- `plan`
- `ruleId`
- `status` (`pending|sent|failed|skipped`)
- `attempts`
- `nextAttemptAt`
- `branchDispatchStatus`
- `lastError`
- `effect`
- `traceId`, `requestId`, `actor`
- `createdAt`, `updatedAt`, `dispatchedAt`

### notification_deliveries（Phase664 add-only fields）
- `branchRuleId`
- `branchMatchedRuleIds[]`
- `branchQueuedAt`
- `branchDispatchStatus`

### opsConfig/journeyGraphCatalog（Phase664 add-only fields）
- `ruleSet.reactionBranches[]`
  - `ruleId`, `enabled`, `priority`
  - `match.actions[]`, `match.planTiers[]`, `match.todoKeys[]`
  - `match.notificationGroups[]`, `match.phaseKeys[]`, `match.domainKeys[]`
  - `effect.todoPatch`, `effect.todoCreate[]`, `effect.nodeUnlockKeys[]`, `effect.queueDispatch`
- `planUnlocks.free.maxNextActions`
- `planUnlocks.pro.maxNextActions`

## Phase663 Add-only Collections（LINE Rich Menu）

### rich_menu_templates/{templateId}
Purpose: Rich Menu テンプレ契約（kind/target/layout/version）を保持する。  
Typical fields:
- `templateId`
- `kind` (`default|phase|plan|combined`)
- `target` (`planTier|phaseId|locale`)
- `layout` (`size`, `areas[]`)
- `status` (`draft|active|deprecated`)
- `lineMeta` (`richMenuId`, `aliasId`, `imageAssetPath`)
- `version`
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_phase_profiles/{phaseId}
Purpose: Journey stage と Rich Menu phase の写像を保持する。  
Typical fields:
- `phaseId` (`pre_departure|arrival|launch|stabilize|repatriation`)
- `status`
- `journeyStageMatchers[]`
- `label`, `description`
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_assignment_rules/{ruleId}
Purpose: plan/phase/combined の割当ルールを保持する。  
Typical fields:
- `ruleId`
- `kind` (`default|phase|plan|combined`)
- `status`
- `templateId`
- `priority`
- `target` (`planTier|phaseId|locale`)
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_rollout_runs/{runId}
Purpose: dry-run/apply/rollback の run evidence を保持する。  
Typical fields:
- `runId`
- `action`, `mode`
- `actor`, `traceId`, `requestId`
- `lineUserIds[]`
- `summary`, `results[]`
- `createdAt`, `updatedAt`

### rich_menu_rate_buckets/{yyyyMMddHHmm}
Purpose: 分単位の apply rate-limit カウンタ。  
Typical fields:
- `bucketId`
- `count`
- `maxCount`
- `lastActor`, `lastTraceId`
- `createdAt`, `updatedAt`

### opsConfig/richMenuPolicy（doc）
Purpose: Rich Menu運用ポリシー（kill switch/cooldown/fallback）を保持する。  
Typical fields:
- `enabled`
- `updateEnabled`
- `defaultTemplateId`
- `fallbackTemplateId`
- `cooldownSeconds`
- `maxAppliesPerMinute`
- `maxTargetsPerApply`
- `allowLegacyJourneyPolicyFallback`
- `updatedAt`, `updatedBy`

### rich_menu_bindings/{lineUserId}（add-only fields）
- `currentTemplateId`
- `previousTemplateId`
- `resolvedRuleId`
- `planTier`
- `phaseId`
- `lastApplyResult`
- `lastTraceId`
- `nextEligibleAt`
- `manualOverrideTemplateId`

### `journey_param_versions/{versionId}`
Purpose: Journey制御パラメータのVersion管理（draft/validate/dry-run/apply/rollback）。

Typical fields:
- `state` (`draft|validated|dry_run_passed|applied|rolled_back|rejected`)
- `effectiveAt`
- `parameters.graph`
- `parameters.journeyPolicy`
- `parameters.llmPolicyPatch`
- `validation`
- `dryRun`
- `appliedMeta`

### `journey_param_change_logs/{id}`
Purpose: Journey Param運用の監査証跡（plan/validate/dry_run/apply/rollback）。

Typical fields:
- `versionId`, `action`, `summary`
- `before`, `after`
- `traceId`, `requestId`, `actor`
- `createdAt`

### `opsConfig/journeyParamRuntime`
Purpose: Journey Paramの active/canary pointer 管理。

Typical fields:
- `enabled`
- `activeVersionId`
- `previousAppliedVersionId`
- `canary{ enabled, versionId, lineUserIds[] }`
