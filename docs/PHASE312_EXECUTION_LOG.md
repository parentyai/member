# PHASE312_EXECUTION_LOG

## 実施内容
- `OPS_SNAPSHOT_MODE=prefer|require` の読取方針を共通化。
- KPI/summary/state の snapshot-first 経路を調整。
- `require` モード時の NOT AVAILABLE 応答を追加。

## 検証コマンド
- `npm run test:docs`
- `npm test`
- `node --test tests/phase312/*.test.js`

## 結果
- PASS
  - `npm run test:docs`
  - `npm test`
  - `node --test tests/phase312/*.test.js`
- 追加:
  - `src/domain/readModel/snapshotReadPolicy.js`
  - `tests/phase312/phase312_t01_snapshot_read_policy_mode_contract.test.js`
  - `tests/phase312/phase312_t02_dashboard_kpi_require_mode_contract.test.js`
  - `tests/phase312/phase312_t03_user_summary_require_mode_contract.test.js`
