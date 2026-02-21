# FULL_SCAN_BOUNDING_PLAN

- 推定 worst-case docs scan: 62000
- hotspot件数: 28
- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。

| rank | file | line | call | estimated_scan | bounded query移行案 |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/routes/admin/osDashboardKpi.js` | 101 | listAllNotificationDeliveries | 15000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 2 | `src/routes/admin/osDashboardKpi.js` | 102 | listAllEvents | 15000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 3 | `src/usecases/admin/getUserOperationalSummary.js` | 103 | listAllUsers | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 4 | `src/usecases/admin/getUserOperationalSummary.js` | 104 | listAllEvents | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 5 | `src/usecases/admin/getUserOperationalSummary.js` | 105 | listAllChecklists | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 6 | `src/usecases/admin/getUserOperationalSummary.js` | 106 | listAllUserChecklists | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 7 | `src/usecases/admin/getUserOperationalSummary.js` | 107 | listAllNotificationDeliveries | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 8 | `src/usecases/admin/getNotificationOperationalSummary.js` | 36 | listAllEvents | 2000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 9 | `src/repos/firestore/phase2ReadRepo.js` | 15 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 10 | `src/repos/firestore/phase2ReadRepo.js` | 23 | listAllUsers | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |

## 段階移行順
1. `/src/routes/admin/osDashboardKpi.js`
2. `/src/usecases/admin/getUserOperationalSummary.js`
3. `/src/usecases/admin/getNotificationOperationalSummary.js`
4. `/src/usecases/phase5/getUserStateSummary.js`
