# FULL_SCAN_BOUNDING_PLAN

- 推定 worst-case docs scan: 4000
- hotspot件数: 4
- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。

| rank | file | line | call | estimated_scan | bounded query移行案 |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/usecases/phase2/runAutomation.js` | 180 | listAllEvents | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 2 | `src/usecases/phase2/runAutomation.js` | 229 | listAllUsers | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 3 | `src/usecases/phase2/runAutomation.js` | 234 | listAllChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |
| 4 | `src/usecases/phase2/runAutomation.js` | 239 | listAllUserChecklists | 1000 | limit上限固定 + snapshot/read-model優先 + where条件明示 |

## 段階移行順
1. `/src/routes/admin/osDashboardKpi.js`
2. `/src/usecases/admin/getUserOperationalSummary.js`
3. `/src/usecases/admin/getNotificationOperationalSummary.js`
4. `/src/usecases/phase5/getUserStateSummary.js`
