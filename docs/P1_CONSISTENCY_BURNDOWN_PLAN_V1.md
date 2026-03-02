# P1_CONSISTENCY_BURNDOWN_PLAN_V1

P0で導入した整合ゲートの次段（未実装計画）を、add-onlyで固定する。

## Scope
- collection drift の実件数削減（baseline固定から解消へ）
- scenarioKey naming drift 44件の段階収束
- unreachable分類済み2ファイルの最終処置方針確定

## Current Snapshot
- command: `npm run audit:consistency:status`
- report source:
  - `docs/REPO_AUDIT_INPUTS/data_model_map.json`
  - `docs/REPO_AUDIT_INPUTS/data_lifecycle.json`
  - `docs/REPO_AUDIT_INPUTS/design_ai_meta.json`
  - `docs/REPO_AUDIT_INPUTS/phase_origin_evidence.json`
  - `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`

## P1 Tracks
1. Collection Drift Burn-down
   - target: `data_model_only`, `data_lifecycle_only` の件数を段階削減
   - gate: `audit:collection-drift:check` は維持（増悪停止）
   - completion: baseline allowlist の件数が連続PRで減少

2. ScenarioKey Canonical Migration
   - target: `design_ai_meta.naming_drift.scenarioKey` 件数を段階削減
   - gate: `audit:scenariokey-drift:check` は維持（増悪停止）
   - completion: allowlist 件数が連続PRで減少

3. Unreachable Finalization
   - target files:
     - `src/repos/firestore/indexFallbackPolicy.js`
     - `src/shared/phaseDocPathResolver.js`
   - gate: `audit:unreachable:check` は維持（分類矛盾停止）
   - completion: 処置方針（凍結継続 / build helper化 / 削除候補）をSSOTで確定

## Rollback
- P1作業で異常が出た場合はPR revert。
- P0ゲート（増悪停止）は維持し、fail-openにしない。
