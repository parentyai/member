# Phase20 BACKLOG PREPARE

## 1. 目的
- Phase20 START時に「何から着手できるか」を即選択可能にする
- 議論コスト削減が目的であり、決定は含まない

## 2. 前提（事実のみ）
- Phase17: 実動ログ検証中（7日）
- Phase18-C: ops UI評価観点 固定済み
- Phase19: Phase17 CLOSE判断パッケージ 固定済み

## 3. 作業カテゴリ定義（判断しない）
- 運用（Ops）
- 観測性（Observability）
- 管理UI（Read / Write 含むが改善は含めない）
- 自動化（スクリプト/集計/定期処理）
- セキュリティ/監査
- UX（Phase20では検討候補）

## 4. Phase20 作業候補バックログ（表）
| ID | カテゴリ | 作業内容（1行） | 依存 | 成果物 | 備考 |
|----|----------|----------------|------|--------|------|
| P20-OPS-01 | 運用（Ops） | 日次の実動ログ記録の運用手順を統一する | RUNBOOK_PHASE17.md | docs | 事実記録のみ |
| P20-OPS-02 | 運用（Ops） | 7日検証の結果記録フォーマットを定義する | ACCEPTANCE_PHASE17.md | docs | 変更ではなく記録枠 |
| P20-OBS-01 | 観測性（Observability） | OBSログの相関キー一覧を整理する | DECISION_PACKAGE_PHASE17_CLOSE.md | docs | 参照のみ |
| P20-OBS-02 | 観測性（Observability） | 失敗時ログの最低取得項目を固定する | RUNBOOK_PHASE17.md | docs | 追加実装なし |
| P20-ADMIN-01 | 管理UI | /admin/ops で参照するAPI一覧を一覧化する | OPS_UI_EVALUATION.md | docs | 表形式 |
| P20-ADMIN-02 | 管理UI | 運用判断の入力導線の有無を棚卸しする | OPS_UI_EVALUATION.md | docs | 参照のみ |
| P20-AUTO-01 | 自動化 | 日次ログ取得の手順を整理する（手動実行前提） | RUNBOOK_PHASE17.md | docs | スクリプト化は含めない |
| P20-AUTO-02 | 自動化 | 定期処理候補の有無を棚卸しする | DECISION_PACKAGE_PHASE17_CLOSE.md | docs | 実装しない |
| P20-SEC-01 | セキュリティ/監査 | 運用証跡の保存場所を整理する | RUNBOOK_PHASE17.md | docs | 参照のみ |
| P20-SEC-02 | セキュリティ/監査 | 監査に必要なログ項目を列挙する | OPS_UI_EVALUATION.md | docs | 変更なし |
| P20-UX-01 | UX | 運用UIで確認する項目の列挙 | OPS_UI_EVALUATION.md | docs | 改善は含めない |
| P20-UX-02 | UX | 運用者の視認手順の整理 | RUNBOOK_PHASE17.md | docs | 手順のみ |

## 5. 明示的な非対象
- LLM連携
- プロダクト仕様拡張
- UIリニューアル
- 認証方式変更

## 6. Phase21以降に送る論点
- 7日検証結果を元にした運用判断の確定方法
- 運用自動化の可否判断
- ダッシュボード化の要否判断

## 参照文書（リンクのみ）
- docs/RUNBOOK_PHASE17.md
- docs/ACCEPTANCE_PHASE17.md
- docs/DECISION_PACKAGE_PHASE17_CLOSE.md
- docs/OPS_UI_EVALUATION.md
