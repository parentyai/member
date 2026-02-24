# PHASE340_PLAN

## 目的
snapshot freshness 契約横断統一を add-only で実装し、既存API互換と既存挙動を維持する。

## スコープ
- phase340対象コード
- `tests/phase340/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase340の契約テストが通る。
- `npm run test:docs` / `npm test` が通る。
