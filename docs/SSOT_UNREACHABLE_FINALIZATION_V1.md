# SSOT_UNREACHABLE_FINALIZATION_V1

`src/index.js` 起点 static require graph で未到達となる2ファイルの最終処置方針を固定する（add-only）。

## Scope
- classification source: `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`
- gate command: `npm run audit:unreachable:check`
- status report: `npm run audit:unreachable:status`
- fixed date: 2026-03-02

## Finalized Targets
| file | status | reachability | disposition | final policy |
| --- | --- | --- | --- | --- |
| `src/repos/firestore/indexFallbackPolicy.js` | frozen | non_reachable_runtime | future_deletion_candidate | runtime再接続しない。削除はSSOT signoff後のみ。 |
| `src/shared/phaseDocPathResolver.js` | monitor | build_time_only | keep_as_build_helper | build-time helperとして維持。runtime再接続しない。 |

## Decision Criteria
### `src/repos/firestore/indexFallbackPolicy.js`
- runtime graph（`src/index.js`）へ再接続しない。
- `scripts/check_structural_cleanup.js` の static graph で未到達を維持する。
- disposition 変更（凍結解除/削除）は以下3点が同時に満たされた場合のみ許可する。
  - `docs/INDEX_PLAN.md` で fallback方針の置換完了が明示されること。
  - `docs/REPO_FULL_AUDIT_REPORT_2026-02-27.md` の到達不能監査項目が更新されること。
  - `docs/REPO_AUDIT_INPUTS/unreachable_classification.json` の理由/参照が更新されること。

### `src/shared/phaseDocPathResolver.js`
- runtime graph（`src/index.js`）へ再接続しない。
- `scripts/generate_phase_path_map.js` が利用する build-time helper としてのみ扱う。
- disposition 変更は、`scripts/generate_phase_path_map.js` の依存解消（または同等置換）を先に実施した場合のみ許可する。

## Operation
1. 監査時は `npm run audit:unreachable:status` で `requiredTargets` を確認する。
2. CIでは `npm run audit:unreachable:check` を必須にし、分類欠落/stale分類を fail させる。
3. 処置方針を更新する場合は、`unreachable_classification.json`・本SSOT・`docs/SSOT_INDEX.md` を同一PRで更新する。

## References
- `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`
- `scripts/check_unreachable_classification.js`
- `scripts/report_unreachable_finalization_status.js`
- `scripts/check_structural_cleanup.js`
- `scripts/generate_phase_path_map.js`
