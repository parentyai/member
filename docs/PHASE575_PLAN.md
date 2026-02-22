# PHASE575_PLAN

## 目的
regional + nationwide(federal_only) の候補を合成する read-only composition 経路を追加する。

## スコープ
- `src/usecases/nationwidePack/composeCityAndNationwidePacks.js`
- `src/routes/admin/cityPacks.js`
- `src/index.js`
- `tests/phase575/*`

## 受入条件
- regional 優先 + nationwide(federal_only) の候補順が返る。
- `/api/admin/city-packs/composition` が admin 保護下で利用できる。
- `npm run test:docs` / `npm test` が通る。
