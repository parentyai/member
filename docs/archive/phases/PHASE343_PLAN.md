# PHASE343_PLAN

## 目的
audit inputs manifest 自動再生成を add-only で実装し、既存API互換と既存挙動を維持する。

## スコープ
- phase343対象コード
- `tests/phase343/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase343の契約テストが通る。
- `npm run test:docs` / `npm test` が通る。
