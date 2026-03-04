# SSOT_JOURNEY_TEMPLATE_V1

Journeyテンプレート（Onboarding / In-Assignment / Offboarding）のSSOT。
Task Engine v1における template 起点 rule 生成契約を定義する。

## 定義（用語）
- Journey Template:
  - 3フェーズ固定の step 定義集合。
  - collection: `journey_templates/{templateId}`
- Phase:
  - `onboarding | in_assignment | offboarding`
- Step:
  - Task化される最小単位。`stepKey` と `trigger/leadTime/dependsOn/constraints` を持つ。
- Compile:
  - template から deterministic に `step_rules` を生成する処理。

## スキーマ（JSON例）
```json
{
  "templateId": "journey_us_v1",
  "version": 1,
  "country": "US",
  "scenarioKey": "US_ASSIGNMENT",
  "enabled": true,
  "validFrom": "2026-03-03T00:00:00.000Z",
  "validUntil": null,
  "phases": [
    {
      "phaseKey": "onboarding",
      "steps": [
        {
          "stepKey": "visa_precheck",
          "title": "ビザ要件の再確認",
          "meaning": {
            "meaningKey": "visa_precheck",
            "title": "ビザ要件の再確認",
            "summary": "渡航直前の差戻しリスクを防ぐ",
            "doneDefinition": "必要書類の期限と不足有無を確認済みにする",
            "whyNow": "期限遅延すると渡航スケジュールへ影響する",
            "helpLinkRegistryIds": ["task_todo_list"],
            "opsNotes": null
          },
          "trigger": { "eventKey": "assignment_created", "source": "admin" },
          "leadTime": { "kind": "after", "days": 1 },
          "dependsOn": [],
          "constraints": { "maxActions": 3, "planLimit": 10 },
          "priority": 100,
          "riskLevel": "high",
          "enabled": true,
          "nudgeTemplate": {
            "title": "Taskリマインド",
            "body": "ビザ要件を確認してください",
            "ctaText": "やることを確認",
            "linkRegistryId": "task_todo_list",
            "notificationCategory": "SEQUENCE_GUIDANCE"
          }
        }
      ]
    },
    {
      "phaseKey": "in_assignment",
      "steps": []
    },
    {
      "phaseKey": "offboarding",
      "steps": []
    }
  ],
  "createdAt": "2026-03-03T00:00:00.000Z",
  "updatedAt": "2026-03-03T00:00:00.000Z",
  "createdBy": "admin_app",
  "updatedBy": "admin_app"
}
```

## 生成/更新ルール
1. `POST /api/admin/os/task-rules/template/plan` で compile し `planHash` / `confirmToken` を発行する。
2. `POST /api/admin/os/task-rules/template/set` は `planHash + confirmToken` 一致時のみ適用する。
3. compile結果の `ruleId` は `<templateId>__<phaseKey>__<stepKey>` とする。
4. template namespace で不要になった rule は削除せず `enabled=false` で停止する。
5. leadTime は v1 で `after | before_deadline` のみ許可する。
6. `steps[].meaning` は add-only 補助メタとして扱い、`step_rules.meaning -> tasks.meaning -> LINE/nudge` へ伝播する。
7. `meaning.meaningKey` は `[a-z0-9_-]{2,64}` を推奨し、重複時は compile warning として扱う（保存は可能）。

## 監査キー
- template: `templateId`, `version`, `country`, `enabled`, `validFrom`, `validUntil`
- step compile: `ruleId`, `phaseKey`, `stepKey`, `planHash`, `warningCount`
- 操作監査:
  - `action=task_rules.template_plan`
  - `action=task_rules.template_set`
  - `traceId`, `requestId`, `actor`

## ロールバック
1. 即時停止: `ENABLE_JOURNEY_TEMPLATE_V1=0`
2. 段階停止: `journey_templates.enabled=false`
3. 影響停止: template namespace の `step_rules.enabled=false`
4. 完全巻き戻し: PR revert（collectionはadd-onlyのため参照停止で無害化）
