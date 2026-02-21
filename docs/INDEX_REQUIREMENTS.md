# INDEX_REQUIREMENTS

Firestore missing-index fallback を段階的に無効化するための最小要件（add-only）。

## 方針
- 現時点の挙動は維持する（fallback は継続）。
- fallback 発生時は WARN ログを必ず記録する。
- `FIRESTORE_FAIL_ON_MISSING_INDEX=1` で fail-closed 化できる設計を維持する（既定は `0`）。

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

## 運用ルール
- 新規 fallback catch を追加する場合は、`tests/phase307/phase307_index_fallback_drift.test.js` に反映すること。
- full-scan を許容する場合は、理由と期限を execution log に残すこと。
