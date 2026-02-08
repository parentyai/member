# PHASE65_69_PLAN

## Purpose
日次レポート自動実行、セグメント抽出、テンプレ送信の plan/execute、安全ガード、証跡自動採取を固定し、運用が迷わない一本道を作る。

## Scope In
- Phase65: 日次レポート実行ジョブ（token認証、idempotent）。
- Phase66: ops console list を使った送信セグメント抽出。
- Phase67: template + segment の dry-run 送信計画（監査ログ必須）。
- Phase68: execute 送信（mode/killSwitch/plan一致ガード）。
- Phase69: docs/runbook + 証跡採取スクリプト。

## Scope Out
- LINEアプリ案（LIFF/画面遷移前提）。
- 既存APIの意味変更・削除。
- 自動送信の既定ON化。

## APIs
- `POST /api/phase65/ops/jobs/daily-report`
- `GET /api/phase66/segments/send-targets`
- `POST /api/phase67/send/plan`
- `POST /api/phase68/send/execute`

## Firestore (append-only)
- `audit_logs`: segment_send plan/execute snapshots
- `ops_daily_reports`: 日次レポート

## Tasks
- T01: 日次レポートジョブ（token必須）
- T02: セグメント抽出
- T03: plan 作成 + audit append
- T04: execute 実行 + guard + audit append
- T05: docs/runbook + evidence script

## Done Definition
- 日次ジョブが token で保護され idempotent。
- セグメント抽出が listOpsConsole と同じ安定順。
- plan/execute が audit_log に残る。
- execute は mode=EXECUTE + plan一致 + killSwitch OFF のみ実行。
- docs/runbook + tests が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
