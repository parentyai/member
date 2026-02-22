# PHASE574_PLAN

## 目的
nationwide city pack の policy/language/class ガードを統一し、監査payloadを固定する。

## スコープ
- `src/usecases/cityPack/validateCityPackSources.js`
- `src/usecases/cityPack/activateCityPack.js`
- `src/routes/admin/cityPacks.js`
- `tests/phase574/*`

## 受入条件
- nationwide policy ガード違反が fail-closed で検出される。
- activate/create の監査payloadが packClass/language/policy 情報を保持する。
- `npm run test:docs` / `npm test` が通る。
