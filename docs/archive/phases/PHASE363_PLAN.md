# PHASE363_PLAN

## 目的
load_risk の集計を runtime callsite 中心に補正し、fallback risk を実運用サーフェス単位で算出する。

## スコープ
- `scripts/generate_load_risk.js`
- `docs/REPO_AUDIT_INPUTS/load_risk.json`（再生成）
- `tests/phase363/*`

## 受入条件
- listAll 関数定義行が hotspot から除外される。
- fallback_risk が unique fallback surface で算出される。
- `npm run test:docs` / `npm test` が通る。
