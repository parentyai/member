# PHASE362_PLAN

## 目的
load risk 予算を current baseline に ratchet し増悪をCIで停止。

## スコープ
- 関連 route/usecase/repo（Phase362差分）
- `tests/phase362/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- read path budget ratchet の契約が add-only で成立する。
- 既存 API 互換を維持する。
- `npm run test:docs` / `npm test` が通る。
