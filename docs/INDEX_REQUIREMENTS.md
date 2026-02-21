# INDEX_REQUIREMENTS

Firestore missing-index fallback を段階的に無効化するための最小要件（add-only）。

## 方針
- 現時点の挙動は維持する（fallback は継続）。
- fallback 発生時は WARN ログを必ず記録する。
- `FIRESTORE_FAIL_ON_MISSING_INDEX=1` で fail-closed 化できる設計を維持する（既定は `0`）。
- 構造収束方針（Phase308 add-only）:
  - `ENV_NAME in {stg,stage,staging,prod,production}` のときは `FIRESTORE_FAIL_ON_MISSING_INDEX` 未指定でも fail-closed。
  - ローカル/テストは従来どおり env var 明示で fail-closed を切替。

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
