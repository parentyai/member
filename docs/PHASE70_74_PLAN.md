# PHASE70_74_PLAN

## Purpose
Ops UI にセグメント送信（plan/execute）と再送キューを統合し、監査と再送を運用で回せる最小の一本道を固定する。

## Scope In
- Phase70: ops_readonly に Segment Send セクション追加（plan/execute）。
- Phase71: planHash を安定化し execute で一致確認（serverTimeBucket 含む）。
- Phase72: 送信失敗を再送キューに append。
- Phase73: 再送キューの一覧 + 手動再送 API。
- Phase74: docs/runbook + 証跡採取スクリプト。

## Scope Out
- 既存APIの意味変更・削除。
- 自動再送（必ず人間操作）。
- LINEアプリ案（LIFF/画面遷移前提）。

## APIs
- `POST /api/phase67/send/plan`
- `POST /api/phase68/send/execute`
- `GET /api/phase73/retry-queue`
- `POST /api/phase73/retry-queue/retry`

## Firestore (append-only)
- `send_retry_queue`: 失敗送信の再送キュー
- `audit_logs`: plan/execute の監査ログ

## Tasks
- T01: Ops UI へ plan/execute セクション追加
- T02: planHash 安定化 + execute で一致確認
- T03: failure を再送キューへ enqueue
- T04: retry queue API + UI
- T05: docs/runbook + evidence script

## PlanHash Definition
- `sha256(templateKey + sorted(lineUserIds).join(',') + serverTimeBucket)`
- serverTimeBucket は UTC の YYYY-MM-DD

## Done Definition
- ops_readonly から plan/execute を操作できる。
- planHash が serverTimeBucket を含み、execute で一致確認される。
- failure が send_retry_queue に append され、retry が手動で可能。
- docs/runbook + tests が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
