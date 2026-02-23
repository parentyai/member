# PHASE629_PLAN

## Goal
stg E2E checklist の先頭に `product_readiness_gate` を追加し、`status=GO` + `retentionRisk/structureRisk ok` を満たさない場合に E2E を fail-closed で停止する。

## Scope
- `tools/run_stg_notification_e2e_checklist.js` に product-readiness 評価シナリオを追加
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md` の固定順チェックを更新
- phase629 契約テストを追加

## Non-Goals
- `product-readiness` API本体ロジックの仕様変更
- retention/structure budget値の変更
