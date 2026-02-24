# PHASE359_PLAN

## 目的
phase2 automation 実行で fallbackMode=allow|block を add-only 追加。

## スコープ
- 関連 route/usecase/repo（Phase359差分）
- `tests/phase359/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase2 automation fallbackMode knob の契約が add-only で成立する。
- 既存 API 互換を維持する。
- `npm run test:docs` / `npm test` が通る。
