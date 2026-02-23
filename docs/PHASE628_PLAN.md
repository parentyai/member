# PHASE628_PLAN

## Goal
`structure_risk` を docs artifact / budget gate / product-readiness / launch-runbook に接続し、構造ドリフトの増悪を CI と運用チェックで同時に停止する。

## Scope
- `scripts/generate_structure_risk.js` を中心に artifact と budget を固定。
- `src/routes/admin/productReadiness.js` に `checks.structureRisk` と blocker 判定を追加。
- `tools/audit/run_audit.sh` に structure risk budget check を追加。
- `docs/STRUCTURE_BUDGETS.md` と launch/runbook を更新。
- phase628 契約テストを追加。

## Non-Goals
- legacy repo 統合そのものは実施しない。
- notification flow / public API の仕様変更は行わない。
