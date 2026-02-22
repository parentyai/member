# FULL_SCAN_BOUNDING_PLAN

- 推定 worst-case docs scan: 0
- hotspot件数: 0
- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。

| rank | file | line | call | estimated_scan | bounded query移行案 |
| --- | --- | --- | --- | --- | --- |

## 段階移行順
1. `/src/routes/admin/osDashboardKpi.js`
2. `/src/usecases/admin/getUserOperationalSummary.js`
3. `/src/usecases/admin/getNotificationOperationalSummary.js`
4. `/src/usecases/phase5/getUserStateSummary.js`
