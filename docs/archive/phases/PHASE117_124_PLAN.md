# PHASE117_124_PLAN

## Purpose
Ops Assist の提案→監査→送信/記録→可視化を最短導線で固定し、運用で回る形にする。

## Scope In
- Ops Assist 対象通知の解決（automation_config + notifications）
- suggestion schema 固定（add-only）
- audit_logs への提案記録（OPS_ASSIST_SUGGESTION）
- decision_logs への採用snapshot保存（source/suggestionSnapshot）
- ops notice send ルート追加（LINE push + deliveries + audit）
- ops console view への suggestion 表示追加
- killSwitch guard（suggestion/notice/automation）

## Scope Out
- 既存APIの破壊的変更
- 自動送信のデフォルトON
- UI新設（ops_readonly.html の拡張のみ）

## Done Definition
- suggestion schema 固定（tests）
- audit append 固定（tests）
- decision log に採用snapshot保存（tests）
- notice send 導線固定（tests）
- ops console view 表示追加（tests）
- killSwitch guard 固定（tests）
- npm test PASS

## Rollback
- revert 実装PR
