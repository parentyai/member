# RUNBOOK_EMERGENCY_LAYER

Emergency Layer の運用手順（stg/prod共通）。

## 1. Preconditions
- `ADMIN_OS_TOKEN` 設定済み
- `CITY_PACK_JOB_TOKEN` 設定済み（internal jobs）
- provider用の `officialLinkRegistryId` が `emergency_providers` に設定済み
- `ENABLE_EMERGENCY=1`（auto send有効時のみ）
- `system_flags.phase0.emergencyAutoSendEnabled=true`（default false）
- 必要なら `LLM_FEATURE_FLAG=1` + `system_flags.llmEnabled=true`

## 2. Scheduled Sync
Workflow:
- `.github/workflows/emergency-layer-sync.yml`（10分間隔）

Manual run:
```bash
node scripts/emergency_sync_runner.js \
  --service-url "$SERVICE_URL" \
  --job-token "$CITY_PACK_JOB_TOKEN" \
  --provider-keys "nws_alerts,usgs_earthquakes" \
  --force-refresh false \
  --skip-summarize true \
  --dry-run true \
  --max-recipients-per-run 1000
```

## 3. Admin Review Flow
1. `/admin/app?pane=emergency-layer` を開く  
2. `Provider一覧を更新` で稼働状態確認  
3. `Emergency Rules` で provider/eventType/region/severity を登録  
4. `Preview` で match件数・受信者見積・block理由を確認  
5. `Inboxを更新` で draft候補確認（通常は自動配信、必要時のみ reject）

## 4. Guard Validation
Auto dispatch / manual approve 共通で以下が強制される:
- kill switch OFF
- link_registry id 必須
- WARN link は送信ブロック
- CTA=1
- 直URL禁止
- role/county/zip 指定は preview で `unsupported_target_dimension` として fail-closed
- `rule.maxRecipients` / `maxRecipientsPerRun` 超過時は送信停止

## 5. Evidence Checklist
- `audit_logs`:
  - `emergency.sync.start|finish|blocked`
  - `emergency.provider.fetch.*`
  - `emergency.provider.normalize.finish`
  - `emergency.provider.summarize.*`
  - `emergency.rule.upsert|update|preview`
  - `emergency.auto_dispatch.start|preview|sent|failed|blocked`
  - `emergency.bulletin.approve.*`
- `emergency_snapshots` の `payloadHash` と `statusCode`
- `emergency_diffs` の `diffType/severity/changedKeys`
- `emergency_bulletins` の `status` 遷移

## 6. Rollback
Immediate stop:
- `system_flags.killSwitch=true`
- `ENABLE_EMERGENCY=0`
- `system_flags.phase0.emergencyAutoSendEnabled=false`

Provider stop:
- `emergency_providers/{providerKey}.status=disabled`

Rule stop:
- `emergency_rules/{ruleId}.enabled=false`

Workflow stop:
- GitHub Actions の `Emergency Layer sync` を disable

Full rollback:
- Emergency Layer PR を revert（1PR単位）
