# AUDIT_RECONSTRUCTION_MAP

- generatedAt: 2026-03-08T02:42:23.550Z
- gitCommit: 746298fa07a773f7a9e066c29481c8c44c9ca081
- branch: main
- sourceDigest: c397ec60bcaa3c38e83a8a1a404a0c1861bcdcf50abe8ff0ff9cf730041f2d71
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Event | Entity | Trace | Evidence |
| --- | --- | --- | --- |
| line_webhook_ingest | Users | traceId seeded from webhook payload and reused as requestId | src/routes/webhookLine.js:175<br>src/routes/webhookLine.js:1806 |
| notification_create | Notifications | traceId persisted in notification flow and audit timeline | src/usecases/notifications/createNotification.js:1<br>src/usecases/notifications/sendNotification.js:1 |
| delivery_result | NotificationDeliveries | delivery rows preserve trace for retries and analytics | src/repos/firestore/deliveriesRepo.js:303<br>src/usecases/phase73/retryQueuedSend.js:22 |
| audit_append | AuditLogs | listAuditLogsByTraceId supports reverse lookup | src/repos/firestore/auditLogsRepo.js:36 |
| decision_timeline_append | DecisionTimeline | listTimelineEntriesByTraceId supports reverse lookup | src/repos/firestore/decisionTimelineRepo.js:63 |
| city_pack_source_audit | SourceEvidence | source evidence stored with trace and recoverable by trace query | src/usecases/cityPack/runCityPackSourceAuditJob.js:249<br>src/repos/firestore/sourceEvidenceRepo.js:64 |
| llm_usage | LlmActionLogs | llm action log normalizes traceId for replay | src/repos/firestore/llmActionLogsRepo.js:267 |
