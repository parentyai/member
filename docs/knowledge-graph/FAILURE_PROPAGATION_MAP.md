# FAILURE_PROPAGATION_MAP

- generatedAt: 2026-03-08T06:11:42.723Z
- source.generatedAt: 2026-03-08T04:34:11.724Z
- source.gitCommit: 690e9ec95691e2bb60ab84db1dc2c33a9fcfff4f
- source.branch: codex/member-integrated-remediation-v1
- note: derived from PROJECT_FAILURE_RECOVERY_MAP + ENTITY_RELATIONS

| Failure | Propagation | Recovery | Evidence |
| --- | --- | --- | --- |
| validation_error | RouteGuard -> OperationBlocked -> AuditLogs(optional) | fail_closed validator response and reject write before persistence | src/domain/validators.js:1<br>src/usecases/notifications/validateNotificationPayload.js:1<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:13 |
| auth_error | RouteGuard -> OperationBlocked -> AuditLogs(optional) | admin/internal token guards stop route execution | src/index.js:150<br>src/routes/internal/cityPackSourceAuditJob.js:27<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:14 |
| kill_switch_enabled | KillSwitchGate -> NotificationPipelineBlocked -> AuditLogs | kill switch gate blocks send and job execution until flag reset | src/domain/validators.js:171<br>docs/REPO_AUDIT_INPUTS/kill_switch_points.json:2<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:15 |
| external_provider_failure | SourceRefs -> SourceEvidence -> CityPackBulletins | error classification + retry queue + source audit status downgrade | src/infra/llmClient.js:78<br>src/usecases/phase68/executeSegmentSend.js:540<br>src/usecases/cityPack/runCityPackSourceAuditJob.js:330<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:16<br>src/usecases/cityPack/runCityPackSourceAuditJob.js:71<br>src/repos/firestore/sourceRefsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:13<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:574 |
| retry_exhausted | Notifications -> NotificationDeliveries -> SendRetryQueue -> AuditLogs | retryQueuedSend give-up path marks queue item with terminal state | src/usecases/phase73/retryQueuedSend.js:22<br>src/usecases/phase73/giveUpRetryQueuedSend.js:1<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:17<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:16 |
| backfill_mismatch | UNOBSERVED_IN_DOCS | deliveryBackfillAdmin checks plan hash and refuses unsafe replay | src/usecases/deliveries/deliveryBackfillAdmin.js:163<br>src/usecases/deliveries/deliveryBackfillAdmin.js:172<br>docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:18 |
