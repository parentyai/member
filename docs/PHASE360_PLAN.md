# PHASE360_PLAN

## 目的
monitor insights に fallbackMode 制御と fallback監査導線を追加。

## スコープ
- 関連 route/usecase/repo（Phase360差分）
- `tests/phase360/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- monitor insights fallbackMode knob の契約が add-only で成立する。
- 既存 API 互換を維持する。
- `npm run test:docs` / `npm test` が通る。
