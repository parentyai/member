# PHASE316_PLAN

## 目的
full-scan hotspot 上位3箇所の `listAll*` 常用経路を bounded read path へ収束し、snapshot-first 運用を維持したまま負荷リスクを縮小する。

## スコープ
- `src/repos/firestore/analyticsReadRepo.js`
- `src/routes/admin/osDashboardKpi.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `tests/phase308/phase308_hotspot_bounded_query_contract.test.js`
- `tests/phase316/*`（新規）

## 受入条件
- `osDashboardKpi` で events/deliveries 読み取りが window 境界付き query 経路になる。
- `getUserOperationalSummary` が `usersRepo.listUsers`（canonical）経路を使う。
- 既存 API 互換（レスポンス契約）を維持。
- `npm run test:docs` / `npm test` / `node --test tests/phase316/*.test.js` が通る。
