# Phase267 Plan

## Goal
- City Pack拡張 PR2 として `sourceType` / `requiredLevel` を実装し、optional source 劣化時の fallback CTA 適用を add-only で固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/sourceRefsRepo.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/validateCityPackSources.js`
- `/Users/parentyai.com/Projects/Member/src/domain/cityPackPolicy.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/notifications/sendNotification.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/notifications/createNotification.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackReviewInbox.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/runCityPackDraftJob.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase267/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE267_EXECUTION_LOG.md`

## Out of scope
- 二段監査（light/heavy）と信頼度スコア（PR3）
- base→override 継承
- import/export

## Acceptance
- `source_refs` に `sourceType` / `requiredLevel` が保存される
- `POST /api/admin/source-refs/:id/policy` が admin token 必須で動作し audit を残す
- `validateCityPackSources` が required/optional を区別し、required failure のみ block する
- optional source failure 時に `cityPackFallback` がある通知は fallback CTA で送信継続できる
- `npm run test:docs` / `npm test` / `node --test tests/phase267/*.test.js` が PASS

## Rollback
- PR単位 `git revert <merge_commit>`
