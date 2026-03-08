# PROJECT_EVENT_AND_JOB_MAP

- generatedAt: 2026-03-08T04:34:11.724Z
- gitCommit: 690e9ec95691e2bb60ab84db1dc2c33a9fcfff4f
- branch: codex/member-integrated-remediation-v1
- sourceDigest: ff4e927a1bcdeab1716540ca6dc05844deac4ac0788ef6be90eccf827bf53653
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Job | Trigger | Entity | Evidence |
| --- | --- | --- | --- |
| audit.yml | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:9 |
| audit.yml | workflow_dispatch | UnknownEntity | .github/workflows/audit.yml:10 |
| npm run test:docs | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:28 |
| npm run docs-artifacts:check | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:31 |
| npm run catchup:drift-check | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:44 |
| npm run firestore-indexes:check -- --contracts-only | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:99 |
| npm run firestore-indexes:check -- --project-id "${FIRESTORE_PROJECT_ID:-$GCP_PROJECT_ID}" | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:103 |
| npm run test:admin-nav-contract | cron:0 4 * * * | UnknownEntity | .github/workflows/audit.yml:143 |
| city-pack-source-audit.yml | cron:15 2 * * * | CityPacks + SourceRefs | .github/workflows/city-pack-source-audit.yml:5 |
| city-pack-source-audit.yml | workflow_dispatch | CityPacks + SourceRefs | .github/workflows/city-pack-source-audit.yml:6 |
| deploy-track.yml | workflow_dispatch | UnknownEntity | .github/workflows/deploy-track.yml:10 |
| deploy-webhook.yml | workflow_dispatch | UnknownEntity | .github/workflows/deploy-webhook.yml:10 |
| deploy.yml | workflow_dispatch | UnknownEntity | .github/workflows/deploy.yml:13 |
| npm run preflight | workflow_dispatch | UnknownEntity | .github/workflows/deploy.yml:79 |
| npm run test:trace-smoke | workflow_dispatch | UnknownEntity | .github/workflows/deploy.yml:85 |
| npm run test:ops-smoke | workflow_dispatch | UnknownEntity | .github/workflows/deploy.yml:89 |
| emergency-layer-sync.yml | cron:*/10 * * * * | UnknownEntity | .github/workflows/emergency-layer-sync.yml:5 |
| emergency-layer-sync.yml | workflow_dispatch | UnknownEntity | .github/workflows/emergency-layer-sync.yml:6 |
| journey-kpi-build.yml | cron:20 22 * * * | JourneyKpiDaily | .github/workflows/journey-kpi-build.yml:5 |
| journey-kpi-build.yml | workflow_dispatch | JourneyKpiDaily | .github/workflows/journey-kpi-build.yml:6 |
| journey-todo-reminder.yml | cron:0 22 * * * | JourneyTodoItems | .github/workflows/journey-todo-reminder.yml:5 |
| journey-todo-reminder.yml | workflow_dispatch | JourneyTodoItems | .github/workflows/journey-todo-reminder.yml:6 |
| municipality-schools-import.yml | cron:30 3 * * 1 | UnknownEntity | .github/workflows/municipality-schools-import.yml:5 |
| municipality-schools-import.yml | workflow_dispatch | UnknownEntity | .github/workflows/municipality-schools-import.yml:6 |
| ops-system-snapshot-build.yml | cron:*/5 * * * * | UnknownEntity | .github/workflows/ops-system-snapshot-build.yml:5 |
| ops-system-snapshot-build.yml | workflow_dispatch | UnknownEntity | .github/workflows/ops-system-snapshot-build.yml:6 |
| phase22-scheduled-dryrun.yml | cron:0 2 * * * | UnknownEntity | .github/workflows/phase22-scheduled-dryrun.yml:5 |
| phase22-scheduled-dryrun.yml | workflow_dispatch | UnknownEntity | .github/workflows/phase22-scheduled-dryrun.yml:6 |
| phase22-scheduled-write.yml | cron:0 3 * * 1 | UnknownEntity | .github/workflows/phase22-scheduled-write.yml:5 |
| phase22-scheduled-write.yml | workflow_dispatch | UnknownEntity | .github/workflows/phase22-scheduled-write.yml:6 |
| school-calendar-audit.yml | cron:45 2 * * * | UnknownEntity | .github/workflows/school-calendar-audit.yml:5 |
| school-calendar-audit.yml | workflow_dispatch | UnknownEntity | .github/workflows/school-calendar-audit.yml:6 |
| stg-notification-e2e.yml | workflow_dispatch | Notifications + NotificationDeliveries | .github/workflows/stg-notification-e2e.yml:4 |
| user-context-snapshot-build.yml | cron:50 21 * * * | UserContextSnapshots | .github/workflows/user-context-snapshot-build.yml:5 |
| user-context-snapshot-build.yml | workflow_dispatch | UserContextSnapshots | .github/workflows/user-context-snapshot-build.yml:6 |
| cityPackDraftGeneratorJob | internal_http_with_x_internal_job_token | CityPacks + SourceRefs | src/routes/internal/cityPackDraftGeneratorJob.js:1 |
| cityPackSourceAuditJob | internal_http_with_x_internal_job_token | CityPacks + SourceRefs | src/routes/internal/cityPackSourceAuditJob.js:1 |
| emergencyJobs | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/emergencyJobs.js:1 |
| journeyBranchDispatchJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/journeyBranchDispatchJob.js:1 |
| journeyKpiBuildJob | internal_http_with_x_internal_job_token | JourneyKpiDaily | src/routes/internal/journeyKpiBuildJob.js:1 |
| journeyTodoReminderJob | internal_http_with_x_internal_job_token | JourneyTodoItems | src/routes/internal/journeyTodoReminderJob.js:1 |
| llmActionRewardFinalizeJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/llmActionRewardFinalizeJob.js:1 |
| municipalitySchoolsImportJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/municipalitySchoolsImportJob.js:1 |
| opsSnapshotJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/opsSnapshotJob.js:1 |
| retentionApplyJob | internal_http_with_x_internal_job_token | RetentionManagedCollections | src/routes/internal/retentionApplyJob.js:1 |
| retentionDryRunJob | internal_http_with_x_internal_job_token | RetentionManagedCollections | src/routes/internal/retentionDryRunJob.js:1 |
| schoolCalendarAuditJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/schoolCalendarAuditJob.js:1 |
| structDriftBackfillJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/structDriftBackfillJob.js:1 |
| taskNudgeJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/taskNudgeJob.js:1 |
| userContextSnapshotJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/userContextSnapshotJob.js:1 |
| userContextSnapshotRecompressJob | internal_http_with_x_internal_job_token | UnknownEntity | src/routes/internal/userContextSnapshotRecompressJob.js:1 |
| runCityPackDraftJob | invoked_by_internal_route_or_scheduler | CityPacks + SourceRefs | src/usecases/cityPack/runCityPackDraftJob.js:1 |
| runCityPackSourceAuditJob | invoked_by_internal_route_or_scheduler | CityPacks + SourceRefs | src/usecases/cityPack/runCityPackSourceAuditJob.js:1 |
| runJourneyBranchDispatchJob | invoked_by_internal_route_or_scheduler | UnknownEntity | src/usecases/journey/runJourneyBranchDispatchJob.js:1 |
| runJourneyTodoReminderJob | invoked_by_internal_route_or_scheduler | JourneyTodoItems | src/usecases/journey/runJourneyTodoReminderJob.js:1 |
| runTaskNudgeJob | invoked_by_internal_route_or_scheduler | UnknownEntity | src/usecases/tasks/runTaskNudgeJob.js:1 |
| deliveryBackfillAdmin | retry_or_backfill_manual_flow | UnknownEntity | src/usecases/deliveries/deliveryBackfillAdmin.js:1 |
| giveUpRetryQueuedSend | retry_or_backfill_manual_flow | SendRetryQueue | src/usecases/phase73/giveUpRetryQueuedSend.js:1 |
| listRetryQueue | retry_or_backfill_manual_flow | SendRetryQueue | src/usecases/phase73/listRetryQueue.js:1 |
| planRetryQueuedSend | retry_or_backfill_manual_flow | SendRetryQueue | src/usecases/phase73/planRetryQueuedSend.js:1 |
| retryQueuedSend | retry_or_backfill_manual_flow | SendRetryQueue | src/usecases/phase73/retryQueuedSend.js:1 |
| runStructDriftBackfill | retry_or_backfill_manual_flow | UnknownEntity | src/usecases/structure/runStructDriftBackfill.js:1 |
