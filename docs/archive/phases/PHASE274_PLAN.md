# Phase274 Plan

## Goal
- City Pack拡張 PR8 として、`city-pack import/export + template library` を add-only で実装する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPacks.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackTemplateLibraryRepo.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackTemplateLibrary.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`
- `/Users/parentyai.com/Projects/Member/tests/phase274/*`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE274_EXECUTION_LOG.md`

## Out of scope
- City Packテンプレの自動生成（LLM提案）
- Firestore Rules本番適用
- Cloud Run/Storage実体を使う統合テスト
- 既存通知API/送信ロジックの意味変更

## Acceptance
- `GET /api/admin/city-packs/:id/export` が動作し、template JSON を返す。
- `POST /api/admin/city-packs/import/dry-run` と `POST /api/admin/city-packs/import/apply` が planHash/confirmToken を必須にして動作する。
- `city_pack_template_library` で list/create/detail/activate/retire が動作する。
- `/admin/app` City Pack pane で Template Library と Import/Export 操作ができる。
- `traceId` 付き監査ログ（`city_pack.template.*`/`city_pack.template_library.*`）が追記される。
- `npm run test:docs` / `npm test` / `node --test tests/phase274/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
