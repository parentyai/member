# PHASE361_PLAN

## 目的
read-path fallback発火時の監査イベント記録を統一。

## スコープ
- 関連 route/usecase/repo（Phase361差分）
- `tests/phase361/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- read path fallback audit trail の契約が add-only で成立する。
- 既存 API 互換を維持する。
- `npm run test:docs` / `npm test` が通る。
