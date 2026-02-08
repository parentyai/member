# PHASE60_64_PLAN

## Purpose
Ops console paginationの改ざん耐性・テンプレ運用の安全CRUD・日次運用レポート・automation段階解放をまとめて固定し、運用が迷わず回るSSOTを作る。

## Scope In
- Phase60: ops-console cursor を HMAC 署名で保護する。
- Phase61: notification templates の最小CRUD（draft/active/inactive）を固定する。
- Phase62: 日次 ops レポート生成のAPI/スクリプトを固定する。
- Phase63: automation mode (OFF/DRY_RUN_ONLY/EXECUTE) で段階解放を固定する。
- Phase64: Runbook/Docs と docs test で運用手順を固定する。

## Scope Out
- LINEアプリ案（LIFF/画面遷移前提）。
- 自動実行の常時ON化。
- 既存APIの意味変更/削除。

## APIs
- `GET /api/phase26/ops-console/list` (cursor signed)
- `POST /api/phase61/templates`
- `PATCH /api/phase61/templates/:key`
- `POST /api/phase61/templates/:key/activate`
- `POST /api/phase61/templates/:key/deactivate`
- `GET /api/phase61/templates?status=...`
- `POST /api/phase62/ops/report/daily`
- `POST /api/phase47/automation/dry-run`
- `GET /api/phase48/automation/config`

## Firestore (append-only)
- `notification_templates`: `key`, `title`, `body`, `ctaText`, `linkRegistryId`, `status`, `createdAt`, `updatedAt`
- `ops_daily_reports`: `date`, `generatedAt`, `counts`, `topReady`
- `automation_config`: `mode` (OFF/DRY_RUN_ONLY/EXECUTE)

## Tasks
- T01: cursor HMAC encode/decode + tamper reject.
- T02: templates CRUD routes + guards.
- T03: daily report usecase/route/script + idempotent write.
- T04: automation mode guard (dry-run only blocks execute).
- T05: runbooks + docs tests.

## Done Definition
- signed cursor が roundtrip でき、改ざんが reject される。
- template CRUD が draft/active/inactive ルールで固定される。
- daily report が日次で生成・保存される（同日再実行OK）。
- automation mode が OFF/DRY_RUN_ONLY/EXECUTE で動作固定。
- Runbook と docs test が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
