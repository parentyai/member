# PHASE357_PLAN

## 目的
phase4 users summary で user_checklists を scoped query優先にし、fallbackMode=block時のfull-scanを抑止。

## スコープ
- 関連 route/usecase/repo（Phase357差分）
- `tests/phase357/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase4 users summary scoped user_checklists の契約が add-only で成立する。
- 既存 API 互換を維持する。
- `npm run test:docs` / `npm test` が通る。
