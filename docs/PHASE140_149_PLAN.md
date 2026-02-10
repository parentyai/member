# PHASE140_149_PLAN

## Purpose
notification_deliveries（SSOT）→ notification health（ctr等）→ Ops Console 表示 → mitigation（advisory）→ decision/audit/trace を一貫して追跡可能にし、運用判断が迷わない状態を固定する。

## Scope In
- notification_deliveries をSSOTとした通知単位の反応集計（sent/clicked/read/ctr/lastReactionAt）
- 通知 read-model に reactionSummary / notificationHealth（OK/WARN/DANGER）を add-only で統合
- Ops Console view に notification health summary / mitigation suggestion（advisory）/ riskLevel を add-only で統合
- notification mitigation の判断（adopt/reject/skip）を decision_logs / audit_logs / trace bundle で traceId 連結
- Trace Search（/api/admin/trace）で追跡できることを維持し、閲覧監査（trace_search.view）を追加
- UI（apps/admin/ops_readonly.html）は表示追加のみ（ロジック追加なし）

## Scope Out
- LLMによる自動実行・自動送信
- 既存API/既存レスポンスキーの意味変更
- 新しい判断ロジック（advisoryを超える自動化）

## Compatibility
- add-only（新規キー/新規監査ログの追加のみ）

## Tests
- 反応集計（reactionSummary/notificationHealth）と read-model 互換
- Ops Console への統合（health summary / mitigation suggestion）
- traceId 連結（view/suggest/decision/execute が追える）

## Rollback
- revert 実装PR #330 / #331
- revert docs CLOSE PR（本ファイル含む）

