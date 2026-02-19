# Phase268 Plan

## Goal
- City Pack拡張 PR3 として、二段監査（light/heavy）・信頼度スコア・Review Inbox優先度を add-only で導入する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/runCityPackSourceAuditJob.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackReviewInbox.js`
- `/Users/parentyai.com/Projects/Member/src/routes/internal/cityPackSourceAuditJob.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/sourceRefsRepo.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase268/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE268_EXECUTION_LOG.md`

## Out of scope
- base→override 継承
- feedback導線
- Change Bulletin / 更新提案
- import/export

## Acceptance
- `runCityPackSourceAuditJob` が `stage=light|heavy` を扱い、`source_refs.confidenceScore` と `source_refs.lastAuditStage` を更新する。
- `/internal/jobs/city-pack-audit-light` と `/internal/jobs/city-pack-audit-heavy` が token guard 付きで動作する。
- `/api/admin/review-inbox` に priority/confidence/stage が含まれ、priority順で返る。
- `/admin/app` の City Pack Inbox/Run UI が priority/confidence/stage と light/heavy モードに追従する。
- `npm run test:docs` / `npm test` / `node --test tests/phase268/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
