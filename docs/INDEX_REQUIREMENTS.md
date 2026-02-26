# INDEX_REQUIREMENTS

Firestore missing-index fallback を段階的に無効化するための最小要件（add-only）。

## 方針
- 現時点の挙動は維持する（fallback は継続）。
- fallback 発生時は WARN ログを必ず記録する。
- `FIRESTORE_FAIL_ON_MISSING_INDEX=1` で fail-closed 化できる設計を維持する（既定は `0`）。
- legacy 管理導線は削除せず段階廃止とし、稼働期間中は `Deprecation/Sunset/Link` ヘッダを返す。
- 構造収束方針（Phase308 add-only）:
  - `ENV_NAME in {stg,stage,staging,prod,production}` のときは `FIRESTORE_FAIL_ON_MISSING_INDEX` 未指定でも fail-closed。
  - ローカル/テストは従来どおり env var 明示で fail-closed を切替。

## 実運用SSOT（Index定義）
- Firestore composite index の実運用定義は `docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json` を唯一のSSOTとする。
- index差分検知は `npm run firestore-indexes:check` を使用する。
- 不足indexの作成コマンド確認は `npm run firestore-indexes:plan -- --project-id <PROJECT_ID>` を使用する。

## Critical契約（route/usecase → requiredIndexIds）
- クリティカル経路のIndex契約は `docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json` の `criticalContracts` を正規参照先とする。
- `criticalContracts[].requiredIndexIds` は同ファイル `indexes[].id` と一致していなければならない。
- `criticalContracts[].sourceEvidence` は `path + line` を必須とし、`npm run firestore-indexes:check` で不整合を検知して失敗させる。
- クリティカル契約対象（Phase633）:
  - `GET /api/admin/product-readiness`
  - `GET /api/admin/read-path-fallback-summary`
  - `GET /api/admin/retention-runs`
  - `GET /api/admin/struct-drift/backfill-runs`
  - `GET /api/admin/os/alerts/summary`
  - `GET /api/admin/city-packs`

## High Priority Queries

### 1) usersRepo.listUsers
- Source: `src/repos/firestore/usersRepo.js`
- Query:
  - `where('scenarioKey','==',...)`
  - `where('stepKey','==',...)`
  - `where('region','==',...)`
  - `orderBy('createdAt','desc')`

### 2) decisionLogsRepo.getLatestDecision / listDecisions
- Source: `src/repos/firestore/decisionLogsRepo.js`
- Query:
  - `where('subjectType','==',...)`
  - `where('subjectId','==',...)`
  - `orderBy('decidedAt','desc')`

### 3) decisionLogsRepo.listDecisionsByNotificationId
- Source: `src/repos/firestore/decisionLogsRepo.js`
- Query:
  - `where('audit.notificationId','==',...)`
  - `orderBy('decidedAt', 'desc|asc')`

### 4) sourceRefsRepo.listSourceRefs
- Source: `src/repos/firestore/sourceRefsRepo.js`
- Query:
  - `where('status','==',...)`
  - `orderBy('updatedAt','desc')`

### 5) linkRegistryRepo.listLinks
- Source: `src/repos/firestore/linkRegistryRepo.js`
- Query:
  - `where('lastHealth.state','==',...)`
  - `orderBy('createdAt','desc')`

### 6) cityPacksRepo.listCityPacks
- Source: `src/repos/firestore/cityPacksRepo.js`
- Query:
  - `where('status','==',...)`
  - `orderBy('updatedAt','desc')`

### 7) templatesVRepo.getLatestTemplateVersion / getActiveTemplate
- Source: `src/repos/firestore/templatesVRepo.js`
- Query:
  - `where('templateKey','==',...)`
  - optional `where('status','==','active')`
  - `orderBy('version','desc')`

### 8) auditLogsRepo.listAuditLogsByTraceId
- Source: `src/repos/firestore/auditLogsRepo.js`
- Query:
  - `where('traceId','==',...)`
  - `orderBy('createdAt','desc')`

### 9) decisionLogsRepo.listDecisionsByTraceId
- Source: `src/repos/firestore/decisionLogsRepo.js`
- Query:
  - `where('traceId','==',...)`
  - `orderBy('decidedAt','desc')`

### 10) decisionTimelineRepo.listTimelineEntriesByTraceId
- Source: `src/repos/firestore/decisionTimelineRepo.js`
- Query:
  - `where('traceId','==',...)`
  - `orderBy('createdAt','desc')`

### 11) analyticsReadRepo.listUsersByCreatedAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - optional `where('createdAt','>=',...)`
  - optional `where('createdAt','<=',...)`
  - `orderBy('createdAt','desc')`

### 12) analyticsReadRepo.listNotificationsByCreatedAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - optional `where('createdAt','>=',...)`
  - optional `where('createdAt','<=',...)`
  - `orderBy('createdAt','desc')`

### 13) analyticsReadRepo.listEventsByLineUserIdAndCreatedAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('lineUserId','==',...)`
  - optional `where('createdAt','>=',...)`
  - optional `where('createdAt','<=',...)`
  - `orderBy('createdAt','desc')`

### 14) analyticsReadRepo.listNotificationDeliveriesByLineUserIdAndSentAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('lineUserId','==',...)`
  - optional `where('sentAt','>=',...)`
  - optional `where('sentAt','<=',...)`
  - `orderBy('sentAt','desc')`

### 15) analyticsReadRepo.listUserChecklistsByLineUserId
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('lineUserId','==',...)`
  - `orderBy('createdAt','desc')`

### 16) analyticsReadRepo.listChecklistsByScenarioAndStep
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('scenario','==',...)`
  - `where('step','==',...)`
  - `orderBy('createdAt','desc')`

### 17) analyticsReadRepo.listUserChecklistsByLineUserIds
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('lineUserId','==',...)`（lineUserIdごとに分割クエリ）
  - `orderBy('createdAt','desc')`

### 18) analyticsReadRepo.listEventsByNotificationIdsAndCreatedAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('ref.notificationId','==',...)`（notificationIdごとに分割クエリ）
  - optional `where('createdAt','>=',...)`
  - optional `where('createdAt','<=',...)`
  - `orderBy('createdAt','desc')`

### 19) analyticsReadRepo.listNotificationDeliveriesByLineUserIdsAndSentAtRange
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('lineUserId','==',...)`（lineUserIdごとに分割クエリ）
  - optional `where('sentAt','>=',...)`
  - optional `where('sentAt','<=',...)`
  - `orderBy('sentAt','desc')`

### 20) analyticsReadRepo.listChecklistsByScenarioStepPairs
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `where('scenario','==',...)`（scenario/stepペアごとに分割クエリ）
  - `where('step','==',...)`
  - `orderBy('createdAt','desc')`

### 21) analyticsReadRepo.listUsersByLineUserIds
- Source: `src/repos/firestore/analyticsReadRepo.js`
- Query:
  - `doc(lineUserId).get()`（lineUserIdごとの分割読み取り）

### 22) Rich Menu Admin Routes（Phase663 add-only）
- Source:
  - `src/repos/firestore/richMenuTemplatesRepo.js`
  - `src/repos/firestore/richMenuAssignmentRulesRepo.js`
  - `src/repos/firestore/richMenuRolloutRunsRepo.js`
- Query:
  - `orderBy('updatedAt','desc')`（templates）
  - `orderBy('priority','desc')`（rules）
  - `orderBy('createdAt','desc')`（runs）
- Note:
  - 現行実装は where + orderBy の複合条件を追加していないため、新規 composite index は必須化しない。
  - status絞り込みは post-filter（アプリ側）で行う。

### 23) Emergency Layer Admin/Internal（Phase669 add-only）
- Source:
  - `src/repos/firestore/emergencyProvidersRepo.js`
  - `src/repos/firestore/emergencySnapshotsRepo.js`
  - `src/repos/firestore/emergencyEventsRepo.js`
  - `src/repos/firestore/emergencyDiffsRepo.js`
  - `src/repos/firestore/emergencyBulletinsRepo.js`
  - `src/repos/firestore/emergencyUnmappedEventsRepo.js`
- Query:
  - `where('providerKey','==',...)` + `limit(...)`（providers/snapshots/events/diffs）
  - `where('snapshotId','==',...)` + `limit(...)`（diffs/unmapped）
  - `where('status','==',...)` **or** `where('regionKey','==',...)` + `limit(...)`（bulletins）
- Note:
  - Emergency Layer は単一 where（status または regionKey）のみを使用し、複合 where を導入しない。
  - 現時点で追加の composite index は必須化しない（missing-index surface 追加なし）。

## 運用ルール
- 新規 fallback catch を追加する場合は、`tests/phase307/phase307_index_fallback_drift.test.js` に反映すること。
- full-scan を許容する場合は、理由と期限を execution log に残すこと。

## Snapshot Read Mode Contract (Phase312 add-only)
- `OPS_SNAPSHOT_MODE=prefer|require`（既定: `prefer`）
- `prefer`:
  - snapshot が新鮮なら snapshot を返却
  - snapshot 不在/期限切れ時のみ bounded fallback を許可
- `require`:
  - snapshot が新鮮なら snapshot を返却
  - snapshot 不在/期限切れ時は `NOT AVAILABLE` を返却し、full-scan fallback を禁止
- 互換:
  - `OPS_SNAPSHOT_READ_ENABLED=0|false` は `disabled` と同等扱い（ローカル/検証向け）
