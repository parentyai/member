# PHASE207_PLAN

## 目的
- `/admin/app` の導入内容をテストで固定し、認証保護・辞書配信・辞書契約の回帰を防ぐ。

## Scope IN
- `/admin/app` と `/admin/ui-dict` の認証保護テスト追加
- `/admin/app` が参照する `ui.*` 辞書キーの契約テスト追加
- Phase207 実行ログ作成

## Scope OUT
- UI 実装変更
- ルーティング仕様変更
- 既存 API 仕様変更

## Target Files
- `tests/phase207/phase207_t01_admin_app_routes_auth.test.js`
- `tests/phase207/phase207_t02_admin_app_dictionary_contract.test.js`
- `docs/archive/phases/PHASE207_EXECUTION_LOG.md`

## Acceptance / Done
- `node --test tests/phase207/*.test.js` が PASS
- `npm test` が PASS
- `npm run test:docs` が PASS
- working tree が CLEAN

## Verification
- `node --test tests/phase207/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/archive/phases/PHASE207_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase207.log`
