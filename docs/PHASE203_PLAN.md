# PHASE203_PLAN

## 目的
一覧→詳細の2階層ドリルダウンを固定し、文脈維持を担保する。

## Scope IN
- monitor/read-model に詳細パネルを追加
- ops の list/detail 構造をテストで固定
- UIラベルを辞書 add-only で追加
- Phase203 実行ログの作成

## Scope OUT
- ルート追加
- API変更
- read-model 変更

## Target Files
- `apps/admin/monitor.html`
- `apps/admin/read_model.html`
- `apps/admin/ops_readonly.html`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase203/phase203_t01_drilldown_panels.test.js`
- `docs/PHASE203_EXECUTION_LOG.md`

## Acceptance / Done
- 一覧→詳細パネルが存在する
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase203/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE203_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase203.log`
