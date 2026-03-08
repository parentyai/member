# PROJECT_FAILURE_RECOVERY_MAP

- generatedAt: 2026-03-08T03:08:07.132Z
- gitCommit: 8bae8342b36e44b086956dc2e1ec93d72398e0a5
- branch: codex/knowledge-graph-v2-finalize
- sourceDigest: abc077ebe50af3043a56474579a2842968ebd435af568f87aadc09d56fba3eb4
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Failure | Recovery | Evidence |
| --- | --- | --- |
| validation_error | fail_closed validator response and reject write before persistence | src/domain/validators.js:1<br>src/usecases/notifications/validateNotificationPayload.js:1 |
| auth_error | admin/internal token guards stop route execution | src/index.js:150<br>src/routes/internal/cityPackSourceAuditJob.js:27 |
| kill_switch_enabled | kill switch gate blocks send and job execution until flag reset | src/domain/validators.js:171<br>docs/REPO_AUDIT_INPUTS/kill_switch_points.json:2 |
| external_provider_failure | error classification + retry queue + source audit status downgrade | src/infra/llmClient.js:78<br>src/usecases/phase68/executeSegmentSend.js:540<br>src/usecases/cityPack/runCityPackSourceAuditJob.js:330 |
| retry_exhausted | retryQueuedSend give-up path marks queue item with terminal state | src/usecases/phase73/retryQueuedSend.js:22<br>src/usecases/phase73/giveUpRetryQueuedSend.js:1 |
| backfill_mismatch | deliveryBackfillAdmin checks plan hash and refuses unsafe replay | src/usecases/deliveries/deliveryBackfillAdmin.js:163<br>src/usecases/deliveries/deliveryBackfillAdmin.js:172 |
