# Phase266 Plan

## Goal
- City Pack拡張PR1として、`targetingRules` と `slots` の最小構造を add-only で実装する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPacksRepo.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/runCityPackDraftJob.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPacks.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackRequests.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/tests/phase266/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE266_EXECUTION_LOG.md`

## Out of scope
- fallback CTA（二段監査/信頼度スコアは次PR）
- base→override 継承
- import/export

## Acceptance
- `city_packs` に `targetingRules[]` と `slots[]` を保持できる
- `POST /api/admin/city-packs/:id/structure` が admin token必須で動く
- draft生成時に default `targetingRules/slots` が作成される
- `/admin/app` で draftの structure JSON を編集・保存できる
- `traceId` 付き `city_pack.structure.update` audit が記録される
- `npm run test:docs` / `npm test` / `node --test tests/phase266/*.test.js` がPASS

## Rollback
- PR単位 `git revert <merge_commit>`
