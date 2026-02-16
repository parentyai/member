# PHASE189_PLAN

## 目的
monitor/read-model で targetCountSource を可視化し、対象人数の誤認を防ぐ。

## Scope IN
- `src/usecases/admin/getNotificationReadModel.js` に targetCount / targetCountSource を追加
- `apps/admin/monitor.html` / `apps/admin/read_model.html` に表示追加
- `docs/ADMIN_UI_DICTIONARY_JA.md` に表示項目の add-only 追記
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md` に read-model キー追加（add-only）
- `tests/phase189` の追加
- `docs/PHASE189_EXECUTION_LOG.md` の追加

## Scope OUT
- targetCount の算出ロジック変更（plan audit 以外の導線追加）
- 既存UI構造変更
- 既存キーの意味変更

## Acceptance / Done
- targetCountSource が monitor/read_model に表示される
- read-model に targetCount / targetCountSource が常在する
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase189/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE189_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase189.log`
