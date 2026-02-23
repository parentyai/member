# PHASE632_EXECUTION_LOG

## Summary
- Firestore index の運用SSOTを追加し、`scripts/check_firestore_indexes.js` で差分検知を実装した。
- `audit.yml` に `firestore-indexes` job を追加し、OIDC認証で index drift をCI検知できるようにした。
- stg (`member-485303`) で不足 index 6件を READY 化し、`npm run firestore-indexes:check` を PASS させた。
- 管理API 6本の再測定で、index不足由来の 500 は解消（`os/alerts/summary` は 200 化）。
- `product-readiness` の 500 は index不足ではなく `missingIndexSurfaceGeneratedAtHours` の未定義バグであることを特定し、コード修正を実施した（デプロイ反映待ち）。

## Required Indexes (SSOT)
- `docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json`
  - `audit_logs_action_createdAt_desc`
  - `link_registry_lastHealth_state_createdAt_desc`
  - `city_packs_language_status_updatedAt_desc`
  - `notifications_status_createdAt_desc`
  - `send_retry_queue_status_createdAt_desc`
  - `decision_logs_audit_notificationId_decidedAt_desc`

## Commands
- `npm run firestore-indexes:plan -- --project-id member-485303`
- `gcloud firestore indexes composite create --project "member-485303" --collection-group="notifications" --query-scope="COLLECTION" --field-config="field-path=status,order=ascending" --field-config="field-path=createdAt,order=descending"`
- `gcloud firestore indexes composite create --project "member-485303" --collection-group="send_retry_queue" --query-scope="COLLECTION" --field-config="field-path=status,order=ascending" --field-config="field-path=createdAt,order=descending"`
- `gcloud firestore indexes composite create --project "member-485303" --collection-group="decision_logs" --query-scope="COLLECTION" --field-config="field-path=audit.notificationId,order=ascending" --field-config="field-path=decidedAt,order=descending"`
- `npm run firestore-indexes:check -- --project-id member-485303`
- `npm run test:docs`
- `node --test tests/phase632/*.test.js`
- `npm test`
- `npm run test:trace-smoke`
- `npm run test:ops-smoke`
- `python3 tools/audit/go_scope_evidence_check.py`

## stg API Recheck
- traceId: `trace-index-recovery-post-index-20260222214945`
- `GET /api/admin/read-path-fallback-summary` => `200`
- `GET /api/admin/retention-runs` => `200`
- `GET /api/admin/struct-drift/backfill-runs` => `200`
- `GET /api/admin/os/alerts/summary` => `200`
- `GET /api/admin/city-packs` => `200`
- `GET /api/admin/product-readiness` => `500`（index不足ではなくコード不整合）

## Log Evidence
- `2026-02-23T02:43:50Z` `admin.os_alerts_summary` route_error: `notifications(status, createdAt)` missing index
- `2026-02-23T02:49:45Z` `admin.product_readiness.view` route_error: `missingIndexSurfaceGeneratedAtHours_is_not_defined`
- `timestamp>=2026-02-23T02:48:00Z` で `FAILED_PRECONDITION requires_an_index` は 0件（member service）

## Result
- index復旧 + drift検知 + CIガード + docs/SSOT索引更新 + 契約テストを1PR差分で完了。
- 残課題は `productReadiness` バグ修正のデプロイ反映のみ（コード修正済み）。
