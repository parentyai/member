# CI_STRUCTURAL_CHECKLIST

## Required checks
- `npm run test:docs`
- `npm run repo-map:check`
- `npm run retention-risk:check`
- `npm run cleanup:check`
- `npm test`

## cleanup:checkで検証すること
- cleanup関連ドキュメントが再生成差分なし
- data_lifecycleがretention policyと同期
- legacy aliasとfrozen markersが維持
