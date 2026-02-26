# RUNBOOK_CRITICAL_CONTRACT_GUARD

W3（機能拡張ランウェイ）で固定するクリティカル契約ガードの運用手順。

## 1. Scope
対象は「product-readiness GO判定に直結する read path」と「city-packs」。

## 2. Critical Endpoints
以下は契約変更禁止（意味変更なし / add-only）。

- `GET /api/admin/product-readiness`
- `GET /api/admin/read-path-fallback-summary`
- `GET /api/admin/retention-runs`
- `GET /api/admin/struct-drift/backfill-runs`
- `GET /api/admin/os/alerts/summary`
- `GET /api/admin/city-packs`

参照:
- `docs/INDEX_REQUIREMENTS.md`
- `docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json`

## 3. Index Contract Gate
### PR-safe check
```bash
npm run firestore-indexes:check -- --contracts-only
```

### deploy前 check
```bash
npm run firestore-indexes:check -- --project-id <PROJECT_ID>
```

### plan出力
```bash
npm run firestore-indexes:plan -- --project-id <PROJECT_ID>
```

## 4. Internal Job Token Guard
`/internal/jobs/*` は token guard 必須。

### CITY_PACK_JOB_TOKEN 系
- `/internal/jobs/city-pack-source-audit`
- `/internal/jobs/city-pack-audit-light`
- `/internal/jobs/city-pack-audit-heavy`
- `/internal/jobs/city-pack-draft-generator`
- `/internal/jobs/emergency-sync`
- `/internal/jobs/emergency-provider-fetch`
- `/internal/jobs/emergency-provider-normalize`
- `/internal/jobs/emergency-provider-summarize`
- `/internal/jobs/struct-drift-backfill`
- `/internal/jobs/retention-dry-run`
- `/internal/jobs/retention-apply`
- `/internal/jobs/ops-snapshot-build`
- `/internal/jobs/user-context-snapshot-build`
- `/internal/jobs/user-context-snapshot-recompress`
- `/internal/jobs/journey-kpi-build`

### JOURNEY_JOB_TOKEN 系
- `/internal/jobs/journey-todo-reminder`

## 5. Confirm Token Guard (Dangerous Admin Writes)
以下は `planHash + confirmToken` を必須化する。

- `src/routes/admin/osKillSwitch.js`
- `src/routes/admin/osConfig.js`
- `src/routes/admin/osAutomationConfig.js`
- `src/routes/admin/osDeliveryRecovery.js`
- `src/routes/admin/osDeliveryBackfill.js`
- `src/routes/admin/cityPacks.js`
- `src/routes/admin/journeyPolicyConfig.js`
- `src/routes/admin/llmConfig.js`
- `src/routes/admin/llmPolicyConfig.js`

## 6. Required Audit Evidence
最低限の監査アクション:
- `product_readiness.view`
- `kill_switch.plan` / `kill_switch.set`
- `system_config.plan` / `system_config.set`
- `notifications.send.plan` / `notifications.send.execute`
- `automation_config.plan` / `automation_config.set`
- `retention.*` / `struct_drift.*`（内部ジョブ実行時）

## 7. Failure Handling
- `contracts-only` がFAIL:
  - `firestore_required_indexes.json` の `requiredIndexIds` と `sourceEvidence` を修正
  - 変更理由をPRに記載
- internal token guard がFAIL:
  - 対象routeのguardを修正
  - workflow secret/env を確認
- confirm token guard がFAIL:
  - plan/setフローを復元
  - route-level mutationを停止し、revert検討

## 8. Emergency Layer Guard（Phase669 add-only）
- `system_flags.killSwitch=true` で Emergency fetch/normalize/summarize/approve は fail-closed で停止する。
- `emergency_providers.status=disabled` で provider 単位停止できる。
- approve/send 経路は既存 validator（CTA=1 / link_registry必須 / WARNリンク遮断 / 直URL禁止）を通過しなければ送信しない。
