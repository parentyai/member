# KILLSWITCH_DEPENDENCY_MAP

- killSwitch依存経路を静的抽出した一覧。
- 抽出件数: 94

| file | line | reference |
| --- | --- | --- |
| `src/domain/validators.js` | 168 | `function validateKillSwitch(killSwitchState) {` |
| `src/domain/validators.js` | 179 | `validateKillSwitch(killSwitchState);` |
| `src/domain/validators.js` | 192 | `validateKillSwitch,` |
| `src/infra/lineClient.js` | 21 | `const value = await systemFlagsRepo.getKillSwitch();` |
| `src/routes/admin/cityPackBulletins.js` | 6 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackBulletins.js` | 226 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackFeedback.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackFeedback.js` | 115 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackRequests.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackRequests.js` | 73 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackReviewInbox.js` | 8 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackReviewInbox.js` | 146 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 7 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/notifications.js` | 128 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 180 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/osAlerts.js` | 102 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/admin/osDashboardKpi.js` | 213 | `systemFlagsRepo.getKillSwitch()` |
| `src/routes/admin/osKillSwitch.js` | 5 | `const { getKillSwitch, setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');` |
| `src/routes/admin/osKillSwitch.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/productReadiness.js` | 285 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/admin/richMenuConfig.js` | 447 | `systemFlagsRepo.getKillSwitch()` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 47 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/emergencyJobs.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/emergencyJobs.js` | 35 | `const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;` |
| `src/routes/internal/emergencyJobs.js` | 47 | `const killSwitchOn = await getKillSwitchFn();` |
| `src/routes/internal/journeyBranchDispatchJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyBranchDispatchJob.js` | 50 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyKpiBuildJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyKpiBuildJob.js` | 38 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyTodoReminderJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyTodoReminderJob.js` | 68 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/municipalitySchoolsImportJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/municipalitySchoolsImportJob.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/opsSnapshotJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/opsSnapshotJob.js` | 27 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/schoolCalendarAuditJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/schoolCalendarAuditJob.js` | 27 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/taskNudgeJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/taskNudgeJob.js` | 43 | `const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;` |
| `src/routes/internal/taskNudgeJob.js` | 53 | `killSwitch = await getKillSwitchFn();` |
| `src/routes/internal/userContextSnapshotJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/userContextSnapshotJob.js` | 59 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/userContextSnapshotRecompressJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/userContextSnapshotRecompressJob.js` | 59 | `const killSwitch = await getKillSwitch();` |
| `src/routes/webhookLine.js` | 3618 | `const customKillSwitchFn = options && typeof options.getKillSwitchFn === 'function'` |
| `src/routes/webhookLine.js` | 3619 | `? options.getKillSwitchFn` |
| `src/usecases/admin/opsSnapshot/computeOpsSystemSnapshot.js` | 374 | `safeQuery('killSwitch', () => systemFlagsRepo.getKillSwitch()),` |
| `src/usecases/adminOs/executeNotificationSend.js` | 220 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 169 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 170 | `? deps.getKillSwitch` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 171 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 172 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 334 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 335 | `? deps.getKillSwitch` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 336 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 345 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 86 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 87 | `? deps.getKillSwitch` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 88 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 89 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 110 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 111 | `? deps.getKillSwitch` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 112 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 113 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/runEmergencySync.js` | 188 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/runEmergencySync.js` | 189 | `? deps.getKillSwitch` |
| `src/usecases/emergency/runEmergencySync.js` | 190 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/runEmergencySync.js` | 191 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 82 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 83 | `? deps.getKillSwitch` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 84 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 85 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/killSwitch/setKillSwitch.js` | 9 | `async function getKillSwitch() {` |
| `src/usecases/killSwitch/setKillSwitch.js` | 10 | `return systemFlagsRepo.getKillSwitch();` |
| `src/usecases/killSwitch/setKillSwitch.js` | 15 | `getKillSwitch` |
| `src/usecases/notifications/runNotificationTest.js` | 12 | `validateKillSwitch,` |
| `src/usecases/notifications/runNotificationTest.js` | 93 | `const getKillSwitch = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/notifications/runNotificationTest.js` | 94 | `const killSwitch = await getKillSwitch();` |
| `src/usecases/notifications/runNotificationTest.js` | 132 | `validateKillSwitch(killSwitch);` |
| `src/usecases/notifications/sendNotification.js` | 12 | `validateKillSwitch,` |
| `src/usecases/notifications/sendNotification.js` | 142 | `validateKillSwitch(payload.killSwitch);` |
| `src/usecases/notifications/testSendNotification.js` | 8 | `const { validateKillSwitch } = require('../../domain/validators');` |
| `src/usecases/notifications/testSendNotification.js` | 92 | `validateKillSwitch(payload.killSwitch);` |
| `src/usecases/phase121/sendOpsNotice.js` | 47 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase33/executeOpsNextAction.js` | 177 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase40/getOpsAssistSuggestion.js` | 121 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase68/executeSegmentSend.js` | 148 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase73/retryQueuedSend.js` | 35 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/tasks/computeUserTasks.js` | 241 | `const killSwitchFn = resolvedDeps.getKillSwitch || systemFlagsRepo.getKillSwitch;` |
| `src/usecases/tasks/runTaskNudgeJob.js` | 201 | `const getKillSwitch = resolvedDeps.getKillSwitch || systemFlagsRepo.getKillSwitch;` |
| `src/usecases/tasks/runTaskNudgeJob.js` | 207 | `killSwitch = await getKillSwitch();` |
