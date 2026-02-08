# PHASE50_54_PLAN

## Purpose
Ops Assist〜Automation の運用を「観測・手順・コスト制御・通知運用・バッチ入口」で固定し、運用で回せる最小完成形をSSOT化する。

## Scope In
- Phase50: Ops観測ログ（OBS）を統一フォーマットで出力。
- Phase51: LLM提案のコスト制御（rate limit + TTL + same input reuse）。
- Phase52: Ops batch 入口を固定（jobKey + dryRun）。
- Phase53: 通知テンプレ運用と Ops判断の接続（suggestedTemplateKey）。
- Phase54: Runbook / docs を運用手順として固定。

## Scope Out
- LINEアプリ案（LIFF/画面遷移前提）。
- 既存APIの意味変更・削除。
- LLMの自動判断・自動送信。

## APIs
- `POST /api/phase52/ops/batch/run`
- `GET /api/phase48/automation/config` (read-only)

## Firestore (append-only)
- `ops_assist_cache` fields: `inputHash`, `expiresAt`, `createdAt`, `model`
- `notification_templates` fields: `key`, `text`, `status`, `createdAt`

## Tasks
- T01: OBS emit (ops console / assist / submit / automation)
- T02: shouldRefreshOpsAssist + cache controls
- T03: ops batch入口 (jobKey + dryRun)
- T04: notification template bridge (suggestedTemplateKey)
- T05: Runbook + docs tests

## Done Definition
- OBS 形式がテストで固定される。
- LLM提案が cache/TTL/inputHash で再生成抑制される。
- Ops batch 入口が dry-run で固定される。
- ops console に suggestedTemplateKey が追加される。
- Runbook が存在し、docs test がPASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
