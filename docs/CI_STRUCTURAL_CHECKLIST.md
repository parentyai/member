# CI_STRUCTURAL_CHECKLIST

## Required checks
- `npm run test:docs`
- `npm run repo-map:check`
- `npm run retention-risk:check`
- `npm run cleanup:check`
- `npm test`

## Catchup Required checks (W0-W4)
- `npm run catchup:drift-check`
- `npm run test:admin-nav-contract`
- `npm run firestore-indexes:check -- --contracts-only`
- `npm run catchup:gate:full`

## cleanup:checkで検証すること
- cleanup関連ドキュメントが再生成差分なし
- data_lifecycleがretention policyと同期
- legacy aliasとfrozen markersが維持

## catchup:drift-checkで検証すること
- repo map / docs artifacts が再生成差分なし
- retention/structure/load/missing-index が予算以内
- collection drift / phase origin / unreachable分類 / scenarioKey drift の増悪がない

## internal job stacked PR で先に見ること
- `npm run internal-jobs:conflict-watchlist`
- 特に `docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json` / `load_risk.json` / `missing_index_surface.json` / `supervisor_master.json` は衝突しやすい
- `docs/KILLSWITCH_DEPENDENCY_MAP.md` と `repo_map_ui.json` も shared route/docs 変更と一緒に動きやすい
- `npm run internal-jobs:merge-regen` は main 取り込み後の再生成順を固定する
- Run this after merging origin/main into the working branch.
- 手動で回す場合は `docs-artifacts:generate` と `audit-inputs:generate` を先に回してから `catchup:drift-check` へ進む
