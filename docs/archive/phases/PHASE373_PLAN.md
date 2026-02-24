# PHASE373 Plan

## Title
City Pack統合（Language導入 + Nationwide=federal_only運用）

## Goal
- `city_packs` に `packClass/language/nationwidePolicy` を add-only 導入する。
- `city_pack_requests` と `city_pack_feedback` に class/language を add-only 反映する。
- `source_refs` に `authorityLevel` を add-only 導入し、Nationwide運用制約を fail-closed で適用する。

## Scope
- Repo:
  - `src/repos/firestore/cityPacksRepo.js`
  - `src/repos/firestore/cityPackRequestsRepo.js`
  - `src/repos/firestore/cityPackFeedbackRepo.js`
  - `src/repos/firestore/sourceRefsRepo.js`
- Usecase/Route:
  - `src/usecases/cityPack/validateCityPackSources.js`
  - `src/usecases/cityPack/activateCityPack.js`
  - `src/usecases/cityPack/runCityPackDraftJob.js`
  - `src/usecases/cityPack/declareCityRegionFromLine.js`
  - `src/usecases/cityPack/declareCityPackFeedbackFromLine.js`
  - `src/usecases/cityPack/runCityPackSourceAuditJob.js`
  - `src/routes/admin/cityPacks.js`
  - `src/routes/admin/cityPackRequests.js`
  - `src/routes/admin/cityPackFeedback.js`
  - `src/routes/admin/cityPackReviewInbox.js`
  - `src/routes/internal/cityPackSourceAuditJob.js`
- Admin UI:
  - `apps/admin/app.html`
  - `apps/admin/assets/admin_app.js`
  - `docs/ADMIN_UI_DICTIONARY_JA.md`
- Docs:
  - `docs/DATA_MAP.md`
  - `docs/SSOT_INDEX.md`

## Non-goals
- Firestore schema rename/delete
- 既存APIの破壊的変更
- 通知ガード仕様の変更（CTA=1、直URL禁止、WARN block、kill switch）

## Acceptance
- `GET /api/admin/city-packs` が `packClass/language` フィルタを受け付ける。
- `source_refs` policy 更新で `authorityLevel` を扱える。
- `packClass=nationwide` の source 検証で federal-only ルールが fail-closed で効く。
- city-pack pane で class/language/authority が表示・絞り込み可能。
