# SSOT_SCENARIOKEY_CANON_V1

`scenarioKey` 命名を canonical として固定し、命名ドリフトの増加をCIで停止する。

## Canonical
- canonical key: `scenarioKey`
- 禁止alias（新規導入禁止）: `scenario`
- 既存実装は P0 で一括置換しない（add-only / 互換維持）

## Gate
- check script: `scripts/check_scenariokey_drift.js`
- command: `npm run audit:scenariokey-drift:check`
- baseline allowlist: `docs/REPO_AUDIT_INPUTS/scenario_key_drift_allowlist.json`

## Policy
- `design_ai_meta.naming_drift.scenarioKey` の新規追加は CI fail。
- `design_ai_meta.naming_drift.scenario` の新規追加は CI fail。
- `scenario_key_drift_allowlist.json` の `resolved.scenarioKey` / `resolved.scenario` に登録した解消済みpathの再導入は CI fail。
- 既知baselineの削減（件数減少）は許容。

## Rollback
- 緊急時は当該PRを revert し、allowlist更新はSSOT根拠付きで別PRに分離する。
