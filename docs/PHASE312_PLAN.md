# PHASE312_PLAN

## 目的
Read path を snapshot-first へ収束し、`OPS_SNAPSHOT_MODE=require` で full-scan fallback を止める。

## スコープ
- `src/routes/admin/osDashboardKpi.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `src/usecases/phase5/getUserStateSummary.js`
- `src/domain/readModel/snapshotReadPolicy.js`（新規）
- `docs/INDEX_REQUIREMENTS.md`（add-only）
- `tests/phase312/*`（新規）

## 受入条件
- dashboard KPI 応答に `dataSource` を追加（互換維持）。
- `OPS_SNAPSHOT_MODE=require` で NOT AVAILABLE を返し full-scan を実行しない。
- `npm test` / `npm run test:docs` PASS。
