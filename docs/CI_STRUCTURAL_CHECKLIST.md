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
