# FULL_SCAN_BOUNDING_PLAN

- 推定 worst-case docs scan: 23000
- hotspot件数: 23
- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。

| rank | file | line | call | estimated_scan | bounded query移行案 |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/repos/firestore/analyticsReadRepo.js` | 29 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 2 | `src/repos/firestore/analyticsReadRepo.js` | 65 | listAllUsers | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 3 | `src/repos/firestore/analyticsReadRepo.js` | 86 | listAllChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 4 | `src/repos/firestore/analyticsReadRepo.js` | 111 | listAllUserChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 5 | `src/repos/firestore/analyticsReadRepo.js` | 134 | listAllNotificationDeliveries | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 6 | `src/repos/firestore/analyticsReadRepo.js` | 170 | listAllNotifications | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 7 | `src/routes/admin/monitorInsights.js` | 103 | listAllNotificationDeliveries | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 8 | `src/routes/admin/osDashboardKpi.js` | 186 | listAllUsers | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 9 | `src/routes/admin/osDashboardKpi.js` | 194 | listAllNotifications | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 10 | `src/usecases/admin/getNotificationOperationalSummary.js` | 194 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |

## 段階移行順
1. `/src/routes/admin/osDashboardKpi.js`
2. `/src/usecases/admin/getUserOperationalSummary.js`
3. `/src/usecases/admin/getNotificationOperationalSummary.js`
4. `/src/usecases/phase5/getUserStateSummary.js`
