# PHASE315_PLAN

## 目的
Struct Cleanup を add-only で実施し、削除なしで Canonical/Legacy 境界、full-scan/fallback/drift/retention の整流情報を固定する。

## スコープ
- `scripts/generate_cleanup_reports.js`（新規）
- `scripts/check_structural_cleanup.js`（新規）
- `scripts/insert_legacy_headers.js`（新規）
- `docs/CLEANUP_*.md`, `docs/INDEX_PLAN.md`, `docs/FULL_SCAN_BOUNDING_PLAN.md`, `docs/NAMING_DRIFT_SCENARIOKEY_PLAN.md`, `docs/SSOT_RETENTION_ADDENDUM.md`, `docs/KILLSWITCH_DEPENDENCY_MAP.md`
- `docs/REPO_AUDIT_INPUTS/data_lifecycle.json`（再生成）
- unreachable baseline 20ファイルへの `LEGACY_FROZEN_DO_NOT_USE` 追記（非破壊）
- `tests/phase315/*`（新規）
- `audit.yml` に `cleanup:check` 追加

## 受入条件
- API/Firestore/route契約の変更なし。
- `npm run cleanup:check` が drift 検出に利用できる。
- unreachable baseline 20 ファイルに凍結マーカーが付与される。
- `npm run test:docs` / `npm test` / `node --test tests/phase315/*.test.js` が通る。
