# KILLSWITCH_DEPENDENCY_MAP

- killSwitch依存経路を静的抽出した一覧。
- 抽出件数: 48

| file | line | reference |
| --- | --- | --- |
| `src/domain/validators.js` | 52 | `function validateKillSwitch(killSwitchState) {` |
| `src/domain/validators.js` | 63 | `validateKillSwitch(killSwitchState);` |
| `src/domain/validators.js` | 74 | `validateKillSwitch,` |
| `src/infra/lineClient.js` | 19 | `const value = await systemFlagsRepo.getKillSwitch();` |
| `src/routes/admin/cityPackBulletins.js` | 6 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackBulletins.js` | 160 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackFeedback.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackFeedback.js` | 115 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackRequests.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackRequests.js` | 63 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/cityPackReviewInbox.js` | 8 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/cityPackReviewInbox.js` | 111 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 7 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/notifications.js` | 120 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/notifications.js` | 172 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/osAlerts.js` | 102 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/admin/osDashboardKpi.js` | 197 | `systemFlagsRepo.getKillSwitch()` |
| `src/routes/admin/osKillSwitch.js` | 5 | `const { getKillSwitch, setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');` |
| `src/routes/admin/osKillSwitch.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/phase1Notifications.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/admin/phase1Notifications.js` | 67 | `const killSwitch = await getKillSwitch();` |
| `src/routes/admin/productReadiness.js` | 285 | `systemFlagsRepo.getKillSwitch(),` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackDraftGeneratorJob.js` | 26 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/cityPackSourceAuditJob.js` | 47 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyKpiBuildJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyKpiBuildJob.js` | 38 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/journeyTodoReminderJob.js` | 3 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/journeyTodoReminderJob.js` | 50 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/opsSnapshotJob.js` | 5 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/opsSnapshotJob.js` | 27 | `const killSwitch = await getKillSwitch();` |
| `src/routes/internal/userContextSnapshotJob.js` | 4 | `const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');` |
| `src/routes/internal/userContextSnapshotJob.js` | 59 | `const killSwitch = await getKillSwitch();` |
| `src/usecases/adminOs/executeNotificationSend.js` | 203 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
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
| `src/usecases/phase43/executeAutomationDecision.js` | 99 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase68/executeSegmentSend.js` | 148 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
| `src/usecases/phase73/retryQueuedSend.js` | 35 | `const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;` |
