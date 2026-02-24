# PHASE333_PLAN

## 目的
phase5 users summary で `snapshotMode=require` 指定時の fallback停止挙動を固定し、snapshot strict の契約を統一する。

## スコープ
- `tests/phase333/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `snapshotMode=require` かつ users summary snapshot 未存在時に空配列を返す契約をテストで固定。
- `npm run test:docs` / `npm test` / `node --test tests/phase333/*.test.js` が通る。
