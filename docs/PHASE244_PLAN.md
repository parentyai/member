# PHASE244_PLAN

## Purpose
- FAQ の confidence 判定を運用可視化するため `kbMeta` 契約を add-only で固定する。

## Scope IN
- FAQ success/blocked payload に `kbMeta` を追加
- `policySnapshotVersion` を add-only 追加
- phase244 テスト追加

## Scope OUT
- confidence 閾値自体の変更

## Acceptance / Done
- success/blocked で `kbMeta` が返る
- `low_confidence` が deterministic に記録される
- `node --test tests/phase244/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase244/*.test.js`
- `npm run test:docs`
- `npm test`
