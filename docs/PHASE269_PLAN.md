# Phase269 Plan

## Goal
- City Pack拡張 PR4 として、base→override 継承（1段制限）を add-only で導入する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPacksRepo.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPacks.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase269/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE269_EXECUTION_LOG.md`

## Out of scope
- 2段以上の継承
- import/export
- Change Bulletin / 更新提案
- 追加のKPI集計

## Acceptance
- `basePackId` を指定した City Pack は `overrides` による上書きで解決される。
- `basePackId` が自己参照または `basePackId` を持つ pack を指す場合、保存を拒否する。
- `/admin/app` の構造編集で `basePackId` を入力でき、保存時に送信される。
- `npm run test:docs` / `npm test` / `node --test tests/phase269/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
