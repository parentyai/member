# NAMING_DRIFT_SCENARIOKEY_PLAN

- 目的: `scenario` と `scenarioKey` の命名ドリフトを mapper層で吸収し、書き込みをcanonicalへ収束させる。
- 破壊的renameは行わない。

| field | count | paths |
| --- | --- | --- |
| scenario (legacy) | 0 |  |
| scenarioKey (canonical) | 11 | `src/repos/firestore/analyticsReadRepo.js`<br>`src/usecases/adminOs/executeNotificationSend.js`<br>`src/usecases/adminOs/planNotificationSend.js`<br>`src/usecases/emergency/approveEmergencyBulletin.js`<br>`src/usecases/journey/runJourneyParamDryRun.js`<br>`src/usecases/notifications/sendNotification.js`<br>`src/usecases/notifications/sendNotificationPhase1.js`<br>`src/usecases/phase2/runAutomation.js`<br>`src/usecases/phase33/executeOpsNextAction.js`<br>`src/usecases/structure/runStructDriftBackfill.js`<br>`src/usecases/tasks/computeUserTasks.js` |

## 移行方針
1. read: `scenarioKey` 優先、`scenario` fallback
2. write: canonical (`scenarioKey`) のみ
3. legacy phase1 usecaseは `DEPRECATED` 表示 + 参照遮断計画を別PRで実施
