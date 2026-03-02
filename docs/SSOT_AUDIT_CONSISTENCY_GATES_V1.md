# SSOT_AUDIT_CONSISTENCY_GATES_V1

監査で検出された整合崩壊ポイントを再発防止するためのCIゲート定義（add-only）。

## Gates
- collection drift
  - command: `npm run audit:collection-drift:check`
  - script: `scripts/check_collection_drift.js`
  - allowlist: `docs/REPO_AUDIT_INPUTS/collection_drift_allowlist.json`
- phase origin evidence
  - command: `npm run audit:phase-origin:check`
  - script: `scripts/check_phase_origin.js`
  - ssot: `docs/REPO_AUDIT_INPUTS/phase_origin_evidence.json`
  - phase map: `docs/PHASE_PATH_MAP.json`
- unreachable classification
  - command: `npm run audit:unreachable:check`
  - script: `scripts/check_unreachable_classification.js`
  - ssot: `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`
- scenarioKey drift
  - command: `npm run audit:scenariokey-drift:check`
  - script: `scripts/check_scenariokey_drift.js`
  - allowlist: `docs/REPO_AUDIT_INPUTS/scenario_key_drift_allowlist.json`
  - canonical rule: `docs/SSOT_SCENARIOKEY_CANON_V1.md`

## CI path
- aggregate gate: `npm run catchup:drift-check`
- workflow: `.github/workflows/audit.yml` (`drift-budgets` job)

## Operating policy
- add-only / 互換維持。
- driftの解消（件数削減）は許容。
- driftの増加や証跡欠落はCIで停止。
