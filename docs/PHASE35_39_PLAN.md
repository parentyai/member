# PHASE35_39_PLAN

## Purpose
LINE会員管理と通知/お知らせ配信、反応記録、Ops判断、LLM提案(監査付き)を、運用で回せる最短導線として固定する。

## Scope In
- Noticeモデルの最小CRUD（draft/active/archived）
- Notice送信（LINE push + deliveries記録 + audit）
- 配信反応の記録（read/click）
- Ops Dashboard（ユーザー×通知×notice×decisionのREAD ONLY一覧）
- Ops Assist提案（deterministic + audit）
- ops_readonly.html へのREAD ONLY表示追加

## Scope Out
- 既存APIの破壊的変更
- 自動判断・自動送信
- 新UIの追加（ops_readonly.htmlの拡張のみ）

## Tasks
- T35: noticesRepo 追加
- T36: notice送信エンドポイント追加
- T37: deliveries reaction 記録追加
- T38: ops dashboard usecase/route/UI追加
- T39: ops assist suggestion (deterministic + audit) 追加

## Done Definition
- Noticeの作成/取得/一覧/ステータス更新が可能
- Notice送信の最短導線（push + deliveries + audit）が固定
- read/clickの反応記録がAPIで固定
- Ops DashboardがREAD ONLYで取得・表示可能
- Ops Assist提案が監査付きで取得可能
- npm test がPASS

## Rollback
- revert 実装PR

## Next
- Noticeテンプレの拡張
- Ops Dashboardの集計指標追加
- Ops Assistの高度化（提案強化）
