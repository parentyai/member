# SSOT Phase2 (v0.1)

## 目的（Phase2 FIX）
1. 運用の自動化（人手削減）
   - Phase1 まで人手だった作業を「安全に」自動化する
   - 失敗時は必ず止まり、再実行できること
2. 判断材料の整備（可視化）
   - events を集計し、人間が判断できる形で提示する
   - 自動判断・自動配信は行わない（提案止まり）
3. 信頼性の底上げ
   - 冪等性 / 再実行耐性 / 部分失敗耐性を明文化・実装する

## 非目的（厳禁）
- Phase0 / Phase1 の仕様変更
- 既存データモデルの破壊的変更
- 自動最適化 / 自動配信 / AI判断
- 公開範囲 / 権限 / CI/CD の変更

## 前提（固定）
- Phase0: CLOSED（immutable）
- Phase1: CLOSED（docs 完備）
- 書き込み経路: UI → API → Usecase → Repo → DB
- events は append-only / best-effort

## スコープ（Phase2 で許可）
### A. Safe Automation（自動化）
- スケジューラ実行（read + write 可）
- 例: 未完了チェックリストの集計、未読/未クリックイベントの集約
- 通知送信・意思決定は行わない

### B. 集計・レポート
- events → 日次 / 週次集計
- 出力先: Firestore（read-model）

### C. 可観測性
- 実行ログ
- 件数 / 失敗数 / 処理時間
- 再実行可能性の証跡

## 実装ルール（Phase2 専用）
- すべて Feature Flag で OFF → ON
- dry-run モード必須
- 冪等キー必須（runId）
- 途中失敗しても再実行で整合が取れること

## Feature Flag / 実行パラメータ
- 環境変数: PHASE2_AUTOMATION_ENABLED
  - 値が "true" の場合のみ実行可能
- リクエスト入力（必須）:
  - runId: string（冪等キー）
  - targetDate: YYYY-MM-DD（集計日）
  - dryRun: boolean（true の場合、DB書き込み禁止）

## API（最小）
- POST /admin/phase2/automation/run
  - Body: { runId, targetDate, dryRun }
  - 成功: { ok: true, summary }
  - 失敗: { ok: false, error }

## 集計対象と出力（概要）
- events（日次/週次）
  - scenario 単位で open/click/complete を集計
- 未完了チェックリスト（日次）
  - checklist の items 数 × users 数 − completed 数

## 冪等性の保証
- report docId は決定的に生成
  - 日次: {date}__{scenario}
  - 週次: {weekStart}__{scenario}
  - checklist: {date}__{scenario}__{step}
- run log は runId を docId に使用

## 失敗時の挙動
- 例外が発生した場合、処理を停止し error を返す
- 部分的な書き込みがあっても、冪等 docId により再実行で整合可能

## Acceptance（Phase2）
- 自動処理が dry-run で再現可能
- 実行ログと処理件数が一致
- 人が判断できる出力が存在する
- OFF に戻せる（ロールバック可能）
