# PROJECT_KNOWLEDGE_GRAPH_V3

- generatedAt: 2026-03-11T23:59:00-05:00
- objective: Admin UI を Knowledge Graph Workbench として再設計するための、Operation/Parameter 拡張付き KG
- observationMode: repo + runtime_probe + UI artifacts

## Observation Evidence
- `git status -sb`: `main` で knowledge-graph docs に既存差分あり（dirty）
- `npm run knowledge-graph:probe-runtime`: 成功（`docs/knowledge-graph/runtime_probe.json`）
- runtime project: `member-485303`（`docs/knowledge-graph/runtime_probe.json:5`）
- runtime collection count: `53`（`docs/knowledge-graph/runtime_probe.json:141`）

## Scope
- Admin shell/panes: `apps/admin/app.html:10,231,557,584,610,639,1019,2194,2364,3305,3409,3672,3871,3940,4050,4110,4154,4487,4552`
- UI runtime: `apps/admin/assets/admin_app.js`
- Admin API gateway: `src/index.js:2207-2460`
- Core admin routes:
  - notifications: `src/routes/admin/osNotifications.js:122-495`
  - city packs: `src/routes/admin/cityPacks.js:136-571`
  - vendors: `src/routes/admin/vendors.js:66-297`
  - llm policy: `src/routes/admin/llmPolicyConfig.js:111-349`

## Knowledge Graph V3 (JoinField/Cardinality/Operation/Parameter)

| From | To | Relation | JoinField | Cardinality | Operation | Parameter | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminUI.Composer | Notifications | create draft | notifications.id | 1:N | `notifications.create` | `notificationType, scenarioKey, stepKey, notificationCategory` | `apps/admin/app.html:711,849,858,768` / `apps/admin/assets/admin_app.js:14299-14324,15123` / `src/routes/admin/osNotifications.js:122-143` / `src/usecases/notifications/createNotification.js:215-244` |
| AdminUI.Composer | Notifications | preview | notifications.id | 1:N | `notifications.preview` | `title, body, ctaText` | `apps/admin/app.html:721,725,729` / `apps/admin/assets/admin_app.js:15153` / `src/routes/admin/osNotifications.js:149-171` |
| AdminUI.Composer | Notifications | approve state transition | notifications.id | 1:1 | `notifications.approve` | `notificationId` | `apps/admin/assets/admin_app.js:15189` / `src/routes/admin/osNotifications.js:177-206` |
| AdminUI.Composer | Notifications | send plan transition | notifications.id | 1:1 | `notifications.send.plan` | `notificationId` | `apps/admin/assets/admin_app.js:15227` / `src/routes/admin/osNotifications.js:211-239` / `src/usecases/adminOs/planNotificationSend.js:95-214` |
| AdminUI.Composer | Notifications | send execute transition | notifications.id | 1:1 | `notifications.send.execute` | `notificationId, planHash, confirmToken` | `apps/admin/assets/admin_app.js:15271` / `src/routes/admin/osNotifications.js:453-484` / `src/usecases/adminOs/executeNotificationSend.js:49-163` |
| Notifications | Users | targeting read | `scenarioKey + stepKey + region` | N:N | `listUsers` (target resolution) | `scenarioKey, stepKey, targetRegion, membersOnly, targetLimit` | `src/usecases/adminOs/planNotificationSend.js:116-123` / `src/usecases/adminOs/executeNotificationSend.js:138-145` / `src/repos/firestore/usersRepo.js:135-137` |
| Notifications | NotificationDeliveries | delivery record relation | `notificationId` | 1:N | delivery lookup / counting | `notificationId, lineUserId` | `src/repos/firestore/deliveriesRepo.js:348-351,1829-1832(runtime)` / `docs/knowledge-graph/runtime_probe.json:1824-1833` |
| Notifications | DecisionTimeline | execution/block timeline | `notificationId` | 1:N | timeline append | `traceId, requestId` | `src/usecases/adminOs/executeNotificationSend.js:256-272` / `docs/knowledge-graph/runtime_probe.json:1333-1348` |
| Notifications | AuditLogs | audit append | `entityId=notificationId` | 1:N | `appendAuditLog` | `payloadSummary` | `src/routes/admin/osNotifications.js:133-141,158-169,195-203,380-395` |
| AdminUI.CityPack | CityPacks | create/update/activate/retire | `cityPackId` | 1:N | `city_pack.*` | `packClass, language, sourceRefs, slotSchemaVersion` | `apps/admin/app.html:2364,2385-2466` / `src/routes/admin/cityPacks.js:136-193,446-488,366-399` |
| CityPacks | SourceRefs | linkage by usedByCityPackIds | `sourceRefId <-> usedByCityPackIds[]` | N:N | `linkCityPack` | `sourceRefs` | `src/usecases/cityPack/activateCityPack.js:131-133` / `src/repos/firestore/sourceRefsRepo.js:505-512,2029(runtime)` / `docs/knowledge-graph/runtime_probe.json:2008-2032` |
| CityPacks | SourceEvidence | evidence chain | `sourceRefId` | 1:N | evidence list | `traceId` | `src/repos/firestore/sourceEvidenceRepo.js:74-76,109-124` |
| AdminUI.Vendors | LinkRegistry(Vendor refs) | list/edit/activate/disable | `linkId` | 1:N | `vendors.list/edit/activate/disable` | `vendorId, name, status, category` | `apps/admin/app.html:3698-3727` / `src/routes/admin/vendors.js:66-82,203-227,229-245,247-293` |
| Vendors | Events | shadow relevance | `lineUserId + todoKey` | 1:N | `vendors.shadow_relevance.list` | `lineUserId, todoKey` | `src/routes/admin/vendors.js:161-201` |
| AdminUI.ReadModel | Users | summary list/read model | `lineUserId` | 1:N | `users-summary analyze/export` | `users-filter-*` | `apps/admin/app.html:3437-3506` / `apps/admin/assets/admin_app.js:2292-2308` / `src/index.js:2374-2380` |
| AdminUI.LLM | OpsConfig.llmPolicy | status/plan/set/history | `opsConfig(llmPolicy)` | 1:1 | `llm_policy.*` | `llm-policy-*` | `apps/admin/app.html:4319-4408` / `src/routes/admin/llmPolicyConfig.js:111-349` |
| OpsConfig.llmPolicy | LlmPolicyChangeLogs | policy change history | `planHash` | 1:N | `llm_policy.set/history` | `planHash, confirmToken` | `src/routes/admin/llmPolicyConfig.js:172-174,222-304,313-342` |
| AdminUI.Audit | AuditLogs | trace search/read | `traceId` | 1:N | audit viewer read | `traceId` | `apps/admin/app.html:3875-3892` / `docs/knowledge-graph/runtime_probe.json:1315-1348` |
| AdminUI.Errors | Ops errors summary | read-only diagnostics | n/a | 1:N | `os.errors.summary` | `window/limit` | `apps/admin/app.html:3308-3386` / `src/index.js:2211-2213` |
| AdminUI.Home | Dashboard KPI | read-only KPI fetch | snapshotKey | 1:N | `os.dashboard.kpi` | `window` | `apps/admin/app.html:265-521` / `src/index.js:2215-2217` / `docs/knowledge-graph/runtime_probe.json:1866-1879` |

## Firestore Runtime Anchors (V3)

| Collection | Runtime fields (excerpt) | Primary use in Admin UI | Evidence |
| --- | --- | --- | --- |
| `notifications` | `body, ctaText, linkRegistryId, scenarioKey, stepKey, title` | Composer draft/preview/send target object | `docs/knowledge-graph/runtime_probe.json:1851-1863` |
| `notification_deliveries` | `delivered, lineUserId, notificationId, sentAt` | Monitor/read-model delivery outcomes | `docs/knowledge-graph/runtime_probe.json:1824-1833` |
| `city_packs` | `packClass, language, sourceRefs, slotContents, status` | City Pack 管理/有効化 | `docs/knowledge-graph/runtime_probe.json:1286-1312` |
| `source_refs` | `sourceType, status, usedByCityPackIds, validFrom, validUntil` | City Pack source監査/連携 | `docs/knowledge-graph/runtime_probe.json:2008-2032` |
| `users` | `memberNumber, regionKey, scenarioKey, stepKey` | Targeting / Read model | `docs/knowledge-graph/runtime_probe.json:2192-2214` |
| `decision_timeline` | `action, lineUserId, notificationId, traceId` | 実行証跡追跡 | `docs/knowledge-graph/runtime_probe.json:1333-1348` |
| `ops_read_model_snapshots` | `snapshotType, data, sourceTraceId` | Dashboard KPI source | `docs/knowledge-graph/runtime_probe.json:1866-1879` |

## Gaps (Observed)
- `source_evidence` は repo 実装が存在（`src/repos/firestore/sourceEvidenceRepo.js:8-124`）するが、runtime_probe の sampled collection 一覧に未掲載。runtime sample 側の未観測として扱う。
- Vendor は UI 用語として存在するが、Firestore collection 名は Link Registry/Events 側（`src/routes/admin/vendors.js:70,175-181`）。

