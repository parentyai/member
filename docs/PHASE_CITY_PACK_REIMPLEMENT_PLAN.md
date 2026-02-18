# PHASE_CITY_PACK_REIMPLEMENT_PLAN

## Goal
City Pack を「都市情報ページ」ではなく、宣言型配信ロジック束 + 情報源 120 日監査機構として add-only で実装する。

## Scope
- 追加コレクション:
  - `source_refs`
  - `source_evidence`
  - `source_audit_runs`
- 追加 API:
  - `GET|POST /api/admin/city-packs`
  - `POST /api/admin/city-packs/:id/activate`
  - `POST /api/admin/city-packs/:id/retire`
  - `GET /api/admin/review-inbox`
  - `GET /api/admin/city-pack-kpi`
  - `GET /api/admin/source-evidence/:id`
  - `POST /api/admin/source-refs/:id/{confirm|retire|replace|manual-only}`
  - `POST /api/admin/city-pack-source-audit/run`
  - `POST /internal/jobs/city-pack-source-audit`
- 追加 UI:
  - `/admin/app` に City Pack 監査ペイン（Review Inbox / Evidence Viewer / KPI / 監査実行）
- 追加 Policy taxonomy:
  - `SOURCE_EXPIRED`
  - `SOURCE_DEAD`
  - `SOURCE_BLOCKED`

## Out of Scope
- 既存通知 API の破壊変更
- 既存コレクション削除
- LLM による採用決定/配信可否決定
- main 直 push

## Data Model (Add-only)
### source_refs
- `url`
- `status` (`active|needs_review|dead|blocked|retired`)
- `validFrom`
- `validUntil` (default: +120日)
- `lastResult`
- `lastCheckAt`
- `contentHash`
- `riskLevel`
- `evidenceLatestId`
- `usedByCityPackIds[]`

### source_evidence
- `sourceRefId`
- `checkedAt`
- `result`
- `statusCode`
- `finalUrl`
- `contentHash`
- `screenshotPaths[]`
- `diffSummary`
- `traceId`
- `llm_used`
- `model`
- `promptVersion`

### source_audit_runs
- `runId`
- `mode`
- `startedAt`
- `endedAt`
- `processed`
- `succeeded`
- `failed`
- `failureTop3[]`
- `traceId`
- `targetSourceRefIds[]`

### city_packs
- `sourceRefs[]` (必須)
- `validUntil` (必須)
- `allowedIntents` (`["CITY_PACK"]` 固定)
- `status` (`draft|active|retired`)
- `rules[]`

## Security/Guard
- Admin API は既存 `requireAdminToken` 配下で fail-closed 維持。
- Internal job は `CITY_PACK_JOB_TOKEN` 必須。
- `source_evidence` は append-only 運用（更新禁止方針）。
- `city_packs/:id/activate` は source state/期限の検証必須。

## Done Criteria
- City Pack コレクション/Repo/Usecase/API/UI が add-only で接続済み。
- Source 期限/状態により `SOURCE_*` が通知送信でブロックされる。
- Review Inbox / Evidence Viewer / KPI / 監査実行が `/admin/app` で利用可能。
- `npm run test:docs` / `npm test` / `node --test tests/phase250/*.test.js` が PASS。
- CI ログ証跡を `docs/CI_EVIDENCE/` に保存。

## Rollback
- 1コミット単位で `git revert`。
- 緊急停止は `CITY_PACK_JOB_TOKEN` 無効化 + feature flag OFF で対応。
