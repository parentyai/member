# PHASE341_PLAN

## 目的
ops snapshot job 部分更新targets対応を add-only で実装し、既存API互換と既存挙動を維持する。

## スコープ
- phase341対象コード
- `tests/phase341/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase341の契約テストが通る。
- `npm run test:docs` / `npm test` が通る。
