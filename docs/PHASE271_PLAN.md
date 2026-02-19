# Phase271 Plan

## Goal
- City Pack拡張 PR6 として、Change Bulletin と 更新提案（人間適用）を add-only で実装する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackBulletinsRepo.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackUpdateProposalsRepo.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackBulletins.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackUpdateProposals.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase271/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE271_EXECUTION_LOG.md`

## Out of scope
- Change Bulletin の自動生成
- Update Proposal の自動生成
- 自動適用 / 自動送信
- import/export / template library
- 追加のKPI集計

## Acceptance
- `/api/admin/city-pack-bulletins` で作成/承認/送信/却下ができる。
- `/api/admin/city-pack-update-proposals` で作成/承認/適用/却下ができる。
- proposalPatch は allowlist のみを適用し、allowlist外は拒否する。
- `/admin/app` に Bulletin/Proposal Inbox + Detail が表示される。
- `npm run test:docs` / `npm test` / `node --test tests/phase271/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
