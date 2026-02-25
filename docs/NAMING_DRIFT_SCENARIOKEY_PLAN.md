# NAMING_DRIFT_SCENARIOKEY_PLAN

- 目的: `scenario` と `scenarioKey` の命名ドリフトを mapper層で吸収し、書き込みをcanonicalへ収束させる。
- 破壊的renameは行わない。

| field | count | paths |
| --- | --- | --- |
| scenario (legacy) | 0 |  |
| scenarioKey (canonical) | 22 | `src/repos/firestore/notificationsRepo.js`<br>`src/repos/firestore/usersRepo.js`<br>`src/routes/admin/monitorInsights.js`<br>`src/routes/admin/notificationDeliveries.js`<br>`src/routes/admin/notifications.js`<br>`src/routes/admin/opsOverview.js`<br>`src/routes/admin/osNotifications.js`<br>`src/routes/admin/readModel.js`<br>`src/routes/admin/userTimeline.js`<br>`src/usecases/admin/getNotificationOperationalSummary.js`<br>`src/usecases/admin/getNotificationReadModel.js`<br>`src/usecases/admin/getUserOperationalSummary.js`<br>`src/usecases/adminOs/executeNotificationSend.js`<br>`src/usecases/adminOs/planNotificationSend.js`<br>`src/usecases/notifications/createNotification.js`<br>`src/usecases/notifications/sendNotification.js`<br>`src/usecases/phase117/resolveAutomationTargets.js`<br>`src/usecases/phase140/getNotificationHealthSummary.js`<br>`src/usecases/phase33/executeOpsNextAction.js`<br>`src/usecases/phase5/getUserStateSummary.js`<br>`src/usecases/users/declareRedacMembershipIdFromLine.js`<br>`src/usecases/users/ensureUser.js` |

## 移行方針
1. read: `scenarioKey` 優先、`scenario` fallback
2. write: canonical (`scenarioKey`) のみ
3. legacy phase1 usecaseは `DEPRECATED` 表示 + 参照遮断計画を別PRで実施
