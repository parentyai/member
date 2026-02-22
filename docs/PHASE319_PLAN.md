# PHASE319_PLAN

## 目的
`getUserOperationalSummary` の events/deliveries 読み取りを bounded range query 優先へ収束し、snapshot fallback 経路の full-scan 常用を縮小する。

## スコープ
- `src/usecases/admin/getUserOperationalSummary.js`
- `tests/phase308/phase308_hotspot_bounded_query_contract.test.js`
- `tests/phase319/*`（新規）
- `docs/SSOT_INDEX.md`

## 受入条件
- `getUserOperationalSummary` が users createdAt に基づく range query を優先する。
- range query 0件時のみ既存 listAll fallback を使う互換設計を維持する。
- `npm run test:docs` / `npm test` / `node --test tests/phase319/*.test.js` が通る。
