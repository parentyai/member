# PROJECT_FAILURE_RECOVERY_MAP

- generatedAt: 2026-03-08T04:34:11.724Z
- gitCommit: 690e9ec95691e2bb60ab84db1dc2c33a9fcfff4f
- branch: codex/member-integrated-remediation-v1
- sourceDigest: ff4e927a1bcdeab1716540ca6dc05844deac4ac0788ef6be90eccf827bf53653
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
