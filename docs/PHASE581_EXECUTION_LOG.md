# Phase581 Execution Log

## Branch
- `codex/foundation-os-unbounded-hotspot-gate`

## Implemented
- phase5 users/notifications/state route に `fallbackOnEmpty` 解析を追加
- `invalid fallbackOnEmpty` の 400 契約を追加
- phase5 filtered usecase から phase4 usecase へ `fallbackOnEmpty` 透過
- phase5 state usecase に failure-only fallback 分岐を追加

## Verification
- `node --test tests/phase581/*.test.js` : pass
- `npm run test:docs` : pass
- `npm test` : pass

## Notes
- 既存 `fallbackMode` / `snapshotMode` は維持。
