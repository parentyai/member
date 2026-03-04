# RUNBOOK_TASK_ENGINE_OPS_V1

Task Engine v1（Journey Template + Step Rules + Task apply）の運用手順。

## 定義（用語）
- Plan:
  - write前に `planHash` / `confirmToken` を発行する read-only 操作。
- Set:
  - plan結果を検証して `step_rules` / `journey_templates` を更新する write 操作。
- Apply:
  - 単一ユーザーへ Task projection を実行する write 操作。

## スキーマ（運用入力JSON例）
```json
{
  "templatePlan": {
    "templateId": "journey_us_v1",
    "template": { "version": 1, "country": "US", "enabled": true, "phases": [] }
  },
  "applyPlan": {
    "lineUserId": "Uxxxxxxxx",
    "memberNumber": null
  }
}
```

## 生成/更新ルール（運用フロー）
1. Template運用:
  - `POST /api/admin/os/task-rules/template/plan`
  - `POST /api/admin/os/task-rules/template/set`
2. Rule単体運用:
  - `POST /api/admin/os/task-rules/plan`
  - `POST /api/admin/os/task-rules/set`
3. ユーザー適用:
  - `POST /api/admin/os/task-rules/apply/plan`
  - `POST /api/admin/os/task-rules/apply`
4. dry-run:
  - `POST /api/admin/os/task-rules/dry-run`
5. writeはすべて `planHash + confirmToken` 一致を必須化。
6. template-plan の warning/preview を確認し、`meaningKey` 重複を解消してから template-set する。

## 監査キー
- `task_rules.template_plan` / `task_rules.template_set`
- `task_rules.plan` / `task_rules.set`
- `task_rules.apply_plan` / `task_rules.apply`
- `task_rules.dry_run`
- 共通キー: `traceId`, `requestId`, `actor`, `lineUserId`, `memberNumber`, `planHash`
- task状態変化監査: `task_events`（`taskId/ruleId/decision/checkedAt/explainKeys`）
- 体験監査: `tasks.view.presented`, `tasks.view.hidden_duplicate`, `tasks.meaning.fallback_used`, `tasks.nudge.suppressed`

## ロールバック
1. 即時停止:
  - `ENABLE_TASK_ENGINE_V1=0`
  - `ENABLE_TASK_NUDGE_V1=0`
  - `ENABLE_TASK_EVENTS_V1=0`
  - `ENABLE_JOURNEY_TEMPLATE_V1=0`
  - `ENABLE_JOURNEY_UNIFIED_VIEW_V1=0`
  - `ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1=0`
  - `ENABLE_LEGACY_TODO_EMIT_DISABLED_V1=0`
2. 段階停止:
  - `journey_templates.enabled=false`
  - template namespace の `step_rules.enabled=false`
3. 完全巻き戻し:
  - PR revert（add-only collectionは参照停止で無害化）
