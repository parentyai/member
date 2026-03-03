# SSOT_STEP_RULES_V1

`step_rules` collection の add-only SSOT。

## Purpose
- Step を Task 化するための判定ルールを宣言的に管理する。
- 人手の都度判断を除去し、dry-run で説明可能にする。

## Collection
- `step_rules/{ruleId}`
- template由来 namespace:
  - `<templateId>__<phaseKey>__<stepKey>`
  - 既存rule削除は禁止。不要ruleは `enabled=false` で停止する。

## Schema (v1)
- `ruleId` (docId)
- `scenarioKey`
- `stepKey`
- `trigger`:
  - `eventKey`
  - `source`
- `leadTime`:
  - `kind`: `after | before_deadline`
  - `days`: `0..3650`
- `dependsOn`: `string[]` (ruleId list)
- `constraints`:
  - `quietHours`: `{ startHourUtc, endHourUtc } | null`
  - `maxActions`: `0..50 | null`
  - `planLimit`: `0..1000 | null`
- `priority`: `0..100000`
- `enabled`: `boolean`
- `validFrom`: ISO8601 | null
- `validUntil`: ISO8601 | null
- `riskLevel`: `low|medium|high`
- `nudgeTemplate` (optional):
  - `title`, `body`, `ctaText`, `linkRegistryId`, `notificationCategory`
- audit fields:
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

## Invariants
- `leadTime.kind` は `after|before_deadline` のみ。
- `dependsOn` は重複除去し順不同で扱う。
- `enabled=true` かつ validity window 内のルールのみ engine 対象。
- collection は add-only 運用（削除/意味変更禁止）。

## Admin OS Contract
- `GET /api/admin/os/task-rules/status`
- `POST /api/admin/os/task-rules/plan`
- `POST /api/admin/os/task-rules/set`
- `POST /api/admin/os/task-rules/template/plan`
- `POST /api/admin/os/task-rules/template/set`
- `POST /api/admin/os/task-rules/apply/plan`
- `POST /api/admin/os/task-rules/apply`
- `GET /api/admin/os/task-rules/history`
- `POST /api/admin/os/task-rules/dry-run`

## Plan/Set Safety
- `planHash + confirmToken` 必須
- `set` は `planHash` の再計算一致が必須
- `template_set` / `apply` も `planHash` 再計算一致を必須化
- `apply` は単一ユーザーのみ（`memberNumber` 多重解決時は `409 multiple_users`）
- 変更履歴は `step_rule_change_logs` に append-only 記録

## Dry-run Explain Contract
- 指定ユーザーで `computeUserTasks` を実行
- 出力:
  - `tasks`, `nextActions`, `blocked`, `explain`
- explain は運用判断の根拠として監査可能であること。
