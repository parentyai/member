# Phase306 Plan

## Goal
- City Pack最深化体験の add-only 補完として、request/feedback/city pack の体験フィールドを拡張し、kill switch ON 時の admin/internal 操作を fail-closed で停止する。
- 既存通知/API互換を維持し、traceId 監査を継続する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackRequestsRepo.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackFeedbackRepo.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPacksRepo.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/declareCityRegionFromLine.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/declareCityPackFeedbackFromLine.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/runCityPackDraftJob.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackRequests.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackReviewInbox.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackFeedback.js`
- `/Users/parentyai.com/Projects/Member/src/routes/internal/cityPackSourceAuditJob.js`
- `/Users/parentyai.com/Projects/Member/src/routes/internal/cityPackDraftGeneratorJob.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`
- `/Users/parentyai.com/Projects/Member/tests/phase306/*`

## Out of scope
- Firestore Rules 本番適用
- Cloud Run/Storage 実体連携の E2E
- LLM 判定ロジック変更

## Acceptance
- `city_pack_requests` に `draftLinkRegistryIds/experienceStage/lastReviewAt` が保存される。
- `city_pack_feedback` が `slotKey/message/resolution/resolvedAt` と status 互換拡張を扱える。
- `city_packs` が `slotContents/slotSchemaVersion` を保存できる。
- kill switch ON で city pack admin write / internal draft & audit job が 409 fail-closed。
- `/api/admin/city-pack-feedback/:id/triage|resolve` が index routing 経由で到達できる。
- `/admin/app` City Pack request/feedback 表示が新フィールドを描画できる。
- `npm test` / `npm run test:docs` / `node --test tests/phase306/*.test.js` PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
