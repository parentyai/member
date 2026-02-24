# Phase270 Plan

## Goal
- City Pack拡張 PR5 として、LINEの誤り報告（feedback）導線を add-only で実装する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackFeedbackRepo.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/declareCityPackFeedbackFromLine.js`
- `/Users/parentyai.com/Projects/Member/src/domain/cityPackFeedbackMessages.js`
- `/Users/parentyai.com/Projects/Member/src/routes/webhookLine.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackFeedback.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase270/*`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE270_EXECUTION_LOG.md`

## Out of scope
- Change Bulletin / 更新提案
- 自動公開・自動延長
- 追加のKPI集計

## Acceptance
- LINE入力 `City Pack Feedback: <内容>` が feedback として保存される。
- `/api/admin/city-pack-feedback` が admin token 必須で一覧・操作できる。
- `/admin/app` に Feedback Inbox/Detail が追加され、Ack/Reject/Propose 操作が可能。
- `npm run test:docs` / `npm test` / `node --test tests/phase270/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
