# FULL_SCAN_BOUNDING_PLAN

- 推定 worst-case docs scan: 20000
- hotspot件数: 20
- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。

| rank | file | line | call | estimated_scan | bounded query移行案 |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/routes/admin/monitorInsights.js` | 127 | listAllNotificationDeliveries | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 2 | `src/routes/admin/osDashboardKpi.js` | 187 | listAllUsers | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 3 | `src/routes/admin/osDashboardKpi.js` | 195 | listAllNotifications | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 4 | `src/usecases/admin/getNotificationOperationalSummary.js` | 240 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 5 | `src/usecases/admin/getUserOperationalSummary.js` | 319 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 6 | `src/usecases/admin/getUserOperationalSummary.js` | 328 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 7 | `src/usecases/admin/getUserOperationalSummary.js` | 336 | listAllNotificationDeliveries | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 8 | `src/usecases/admin/getUserOperationalSummary.js` | 351 | listAllNotificationDeliveries | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 9 | `src/usecases/admin/getUserOperationalSummary.js` | 365 | listAllChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 10 | `src/usecases/admin/getUserOperationalSummary.js` | 373 | listAllUserChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |

## 段階移行順
1. `/src/routes/admin/osDashboardKpi.js`
2. `/src/usecases/admin/getUserOperationalSummary.js`
3. `/src/usecases/admin/getNotificationOperationalSummary.js`
4. `/src/usecases/phase5/getUserStateSummary.js`
