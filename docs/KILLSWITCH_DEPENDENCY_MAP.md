# KILLSWITCH_DEPENDENCY_MAP

- killSwitch依存経路を静的抽出した一覧。
- 抽出件数: 82

| file | line | reference |
| --- | --- | --- |
| `src/domain/validators.js` | 52 | `function validateKillSwitch(killSwitchState) {` |
| `src/domain/validators.js` | 63 | `validateKillSwitch(killSwitchState);` |
| `src/domain/validators.js` | 74 | `validateKillSwitch,` |
| `src/infra/lineClient.js` | 19 | `const value = await systemFlagsRepo.getKillSwitch();` |
| `src/routes/admin/cityPackBulletins.js` | 6 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackBulletins.js` | 183 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackFeedback.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackFeedback.js` | 115 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackRequests.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackRequests.js` | 63 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackReviewInbox.js` | 8 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackReviewInbox.js` | 132 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 7 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/notifications.js` | 120 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 172 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/osAlerts.js` | 102 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/admin/osDashboardKpi.js` | 203 | `systemFlagsRepo.getKillSwitch()` |
| `src/routes/admin/osKillSwitch.js` | 5 | `const { getKillSwitch, setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');` |
| `src/routes/admin/osKillSwitch.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/phase1Notifications.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/phase1Notifications.js` | 67 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/productReadiness.js` | 285 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/admin/richMenuConfig.js` | 447 | `systemFlagsRepo.getKillSwitch()` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 47 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/emergencyJobs.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/emergencyJobs.js` | 31 | `const killSwitchOn = await getKillSwitch();` |
| `src/routes/internal/journeyBranchDispatchJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyBranchDispatchJob.js` | 50 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyKpiBuildJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyKpiBuildJob.js` | 38 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyTodoReminderJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyTodoReminderJob.js` | 50 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/municipalitySchoolsImportJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/municipalitySchoolsImportJob.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/opsSnapshotJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/opsSnapshotJob.js` | 27 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/schoolCalendarAuditJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/schoolCalendarAuditJob.js` | 27 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/userContextSnapshotJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/userContextSnapshotJob.js` | 59 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/userContextSnapshotRecompressJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/userContextSnapshotRecompressJob.js` | 59 | `const killSwitch = await getKillSwitch();` |
| `src/usecases/adminOs/executeNotificationSend.js` | 203 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 116 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 117 | `? deps.getKillSwitch` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 118 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 119 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 273 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 274 | `? deps.getKillSwitch` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 275 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/approveEmergencyBulletin.js` | 284 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 86 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 87 | `? deps.getKillSwitch` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 88 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/fetchProviderSnapshot.js` | 89 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 110 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 111 | `? deps.getKillSwitch` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 112 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/normalizeAndDiffProvider.js` | 113 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/runEmergencySync.js` | 140 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/runEmergencySync.js` | 141 | `? deps.getKillSwitch` |
| `src/usecases/emergency/runEmergencySync.js` | 142 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/runEmergencySync.js` | 143 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 82 | `const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 83 | `? deps.getKillSwitch` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 84 | `: systemFlagsRepo.getKillSwitch;` |
| `src/usecases/emergency/summarizeDraftWithLLM.js` | 85 | `const killSwitchOn = await getKillSwitch();` |
| `src/usecases/killSwitch/setKillSwitch.js` | 9 | `async function getKillSwitch() {` |
| `src/usecases/killSwitch/setKillSwitch.js` | 10 | `return systemFlagsRepo.getKillSwitch();` |
| `src/usecases/killSwitch/setKillSwitch.js` | 15 | `getKillSwitch` |
| `src/usecases/notifications/runNotificationTest.js` | 80 | `const getKillSwitch = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/notifications/runNotificationTest.js` | 81 | `const killSwitch = await getKillSwitch();` |
| `src/usecases/notifications/testSendNotification.js` | 8 | `const { validateKillSwitch } = require('../../domain/validators');` |
| `src/usecases/notifications/testSendNotification.js` | 78 | `validateKillSwitch(payload.killSwitch);` |
| `src/usecases/phase121/sendOpsNotice.js` | 47 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase33/executeOpsNextAction.js` | 176 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase40/getOpsAssistSuggestion.js` | 121 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase68/executeSegmentSend.js` | 148 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase73/retryQueuedSend.js` | 35 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
