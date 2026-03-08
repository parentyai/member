# DATA_FLOW

- generatedAt: 2026-03-08T02:42:23.550Z
- gitCommit: 746298fa07a773f7a9e066c29481c8c44c9ca081
- branch: main
- sourceDigest: c397ec60bcaa3c38e83a8a1a404a0c1861bcdcf50abe8ff0ff9cf730041f2d71
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Step | From | To | Entity | Action | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | User(Line) | webhookLine | Users | ingest_message_and_trace_seed | src/routes/webhookLine.js:175<br>src/routes/webhookLine.js:2338 |
| 2 | webhookLine | computeUserTasks | JourneyTodoItems | next_action_materialize | src/routes/webhookLine.js:2399<br>src/usecases/tasks/computeUserTasks.js:1<br>src/repos/firestore/journeyTodoItemsRepo.js:1 |
| 3 | Admin(osNotifications) | createNotification/approveNotification | Notifications | notification_draft_and_activate | src/routes/admin/osNotifications.js:1<br>src/usecases/notifications/createNotification.js:1<br>src/usecases/adminOs/approveNotification.js:1 |
| 4 | sendNotification | deliveriesRepo | NotificationDeliveries | delivery_write_and_status_update | src/usecases/notifications/sendNotification.js:1<br>src/repos/firestore/deliveriesRepo.js:1 |
| 5 | delivery failure | retryQueuedSend | SendRetryQueue | retry_enqueue_and_execute | src/usecases/phase68/executeSegmentSend.js:540<br>src/usecases/phase73/retryQueuedSend.js:22<br>src/repos/firestore/sendRetryQueueRepo.js:1 |
| 6 | declareCityRegionFromLine | runCityPackDraftJob | CityPacks + SourceRefs | regional_pack_and_vendor_source_materialize | src/usecases/cityPack/declareCityRegionFromLine.js:1<br>src/usecases/cityPack/runCityPackDraftJob.js:159<br>src/repos/firestore/cityPacksRepo.js:1<br>src/repos/firestore/sourceRefsRepo.js:1 |
| 7 | runCityPackSourceAuditJob | sourceEvidenceRepo + cityPackBulletinsRepo | SourceEvidence + CityPackBulletins | source_fetch_diff_and_evidence | src/usecases/cityPack/runCityPackSourceAuditJob.js:71<br>src/repos/firestore/sourceEvidenceRepo.js:1<br>src/repos/firestore/cityPackBulletinsRepo.js:1 |
| 8 | phaseLLM4FaqAnswer | llmClient | LlmResponse | llm_request_response | src/routes/phaseLLM4FaqAnswer.js:1<br>src/infra/llmClient.js:63 |
| 9 | llm response | faqAnswerLogs + llmUsageLogs | FaqAnswerLogs + LlmUsageLogs | llm_result_persist | src/usecases/faq/answerFaqFromKb.js:1<br>src/repos/firestore/faqAnswerLogsRepo.js:1<br>src/repos/firestore/llmUsageLogsRepo.js:1 |
| 10 | trace aware writes | auditLogs + decisionTimeline | AuditLogs + DecisionTimeline | audit_reconstruction_anchor | src/repos/firestore/auditLogsRepo.js:36<br>src/repos/firestore/decisionTimelineRepo.js:63 |
