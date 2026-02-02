# GO Scope for Real-Test Readiness

## 必要範囲（実テスト開始に必要）
- Phase0（運用/実テスト手順に直結）
  - docs/PLAYBOOK_PHASE0_*.md
  - docs/RUNBOOK_PHASE0.md
  - docs/ACCEPTANCE_PHASE0.md
  - TODO_PHASE0.md
- Phase12（実装対象固定の確認）
  - docs/SSOT_PHASE12.md
  - docs/TODO_PHASE12.md
  - docs/ACCEPTANCE_PHASE12.md
- Phase13（運用引き渡し）
  - docs/SSOT_PHASE13.md
  - docs/TODO_PHASE13.md
  - docs/ACCEPTANCE_PHASE13.md
  - docs/PHASE13_OPERATIONS_HANDOFF.md

## 非対象（実テスト開始に影響しない範囲）
- Phase1〜Phase11 の過去設計/台帳/証跡（実テスト開始に直接影響しない）
- P4-106 など設計専用ドキュメント（実テスト前提の手順に直結しない）
- ミニアプリ関連（Phase14 で撤回・削除済み、対象外）

## 判定ルール
- 必要範囲内の Evidence UNKNOWN/未記録/未確認/未実施 は 0 件であること
- 非対象は残存を許容するが、理由を台帳で明示する
- Mini app が存在しないことは FAIL 条件ではない
- Mini app に関する検証は Phase14 では実施しない
