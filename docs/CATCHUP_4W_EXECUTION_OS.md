# CATCHUP_4W_EXECUTION_OS

機能拡張とデザイン着手の前に、Member の運用安全・契約整合・構造負債・設計準備を
4週間で固定するための実行OS（add-only）。

更新日: 2026-02-25

## 1. Default Policy
- 実行順: 基盤 -> 機能 -> デザイン
- 期間: 4週間
- 環境: stg 完了後に prod 判定
- 変更原則:
  - add-only
  - rollback 可能
  - SSOT/Runbook/CI を一次情報とする
  - 未観測断定禁止

## 2. Scope / Non-Goals
- Scope:
  - ガバナンス整備（SSOT/Runbook/PR/CI）
  - 構造負債の増悪停止と圧縮準備
  - クリティカル契約の固定
  - デザイン着手前チェックの固定
- Non-Goals:
  - 新機能本体の実装
  - 既存API意味変更
  - スキーマ意味変更
  - 削除/整理中心の破壊的改修

## 3. Wave Plan (Decision Complete)
| Wave | 期間 | 目的 | 実行内容 | 完了条件 |
| --- | --- | --- | --- | --- |
| W0 | Day 1-2 | ベースライン固定 | 現行ゲートの証跡を1本化し、DoR/DoDと差分扱いを固定する。 | コマンド結果と証跡パスが `docs/CATCHUP_4W_EVIDENCE.md` に記録される。 |
| W1 | Week 1 | ガバナンス整備 | SSOT/Runbook/PRテンプレ/CIゲートを拡張前仕様で統合する。 | docs/PR/CI の必須チェックが揃い、運用手順が固定される。 |
| W2 | Week 2 | 構造負債封じ込め | `scenario/scenarioKey` と legacy repo の増悪ゼロを固定し、struct drift backfill 手順を証跡化する。 | `structure_risk` が予算以内、`active_legacy_repo_imports=0` を維持する。 |
| W3 | Week 3 | 機能拡張ランウェイ | product-readiness 6経路 + city-packs の契約を固定し、index/token/confirmToken 監査を標準化する。 | 契約テストと runbook が一致し、実装時の判断分岐が残らない。 |
| W4 | Week 4 | デザイン着手準備 | UI在庫・辞書契約・ナビ契約・モバイル観点をチェックリスト化し、stg固定順E2E証跡を確定する。 | デザイン着手前チェックが運用可能な形で固定される。 |

## 4. DoR / DoD
### DoR (開始条件)
- `git status -sb` を確認済み
- 対象SSOT/Runbook/CIパスを列挙済み
- 影響カテゴリ（Code/Data/API/UI/Ops/Security/CI-Docs）を列挙済み
- rollback 手段（即時停止/段階巻き戻し/完全revert）を明示済み

### DoD (完了条件)
- 必須コマンドが PASS
- 追加した docs/test/CI が整合
- 監査証跡（traceId, audit action, 実行ログ）が追跡可能
- 未解決リスクと次の一手を明記

## 5. Command Gate
### PR Gate (固定)
```bash
npm run test:docs
npm run test:admin-nav-contract
npm run catchup:drift-check
npm run firestore-indexes:check -- --contracts-only
```

### Full Gate (固定)
```bash
npm run catchup:gate:full
```

### stg Fixed-Order E2E (固定)
```bash
npm run ops:stg-e2e -- \
  --base-url http://127.0.0.1:18080 \
  --admin-token "$ADMIN_OS_TOKEN" \
  --expect-llm-enabled \
  --fail-on-route-errors \
  --fail-on-missing-audit-actions
```

## 6. Evidence Path (固定)
- ベースライン証跡: `docs/CATCHUP_4W_EVIDENCE.md`
- trace smoke 証跡: `docs/TRACE_SMOKE_EVIDENCE.md`
- stg E2E 証跡: `artifacts/stg-notification-e2e/*.json` と `docs/archive/phases/`

## 7. Rollback Policy
- 即時停止:
  - kill switch ON
  - `ENABLE_ADMIN_NAV_ROLLOUT_V1=0`
  - `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=0`
  - `RETENTION_APPLY_ENABLED=0`
- 段階巻き戻し:
  - Wave単位でPR分離し、対象Waveのみrevert
- 完全巻き戻し:
  - PR/commit を revert
  - deploy 変数/secret を直前値に戻して再デプロイ

## 8. Linked Guard Docs
- `docs/SSOT_INDEX.md`
- `docs/RUNBOOK_ADMIN_OPS.md`
- `docs/INDEX_REQUIREMENTS.md`
- `docs/STRUCTURE_BUDGETS.md`
- `docs/RUNBOOK_STRUCT_DRIFT_BACKFILL.md`
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md`
- `docs/CATCHUP_W4_DESIGN_READINESS_CHECKLIST.md`
- `docs/CATCHUP_GO_DECISION_PACKAGE.md`
