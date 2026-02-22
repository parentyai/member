# PHASE352_PLAN

## 目的
Phase352 の add-only 補強を実施し、checklist read-path を scenario/step scoped query 優先へ収束する。

## スコープ
- `src/repos/firestore/analyticsReadRepo.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `src/usecases/phase5/getUserStateSummary.js`
- `docs/INDEX_REQUIREMENTS.md`
- `tests/phase352/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `listChecklistsByScenarioAndStep` が追加される。
- phase4/phase5 の checklist 取得が scoped query 優先になり、fallbackMode 契約を維持する。
- `npm run test:docs` / `npm test` が通る。
