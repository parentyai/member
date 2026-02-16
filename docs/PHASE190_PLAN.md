# PHASE190_PLAN

## 目的
policy/cap の誤解を防ぐため、reason / countMode / countSource を UI と read-model に明示する。

## Scope IN
- `src/usecases/admin/getNotificationReadModel.js` に execute summary（reason/mode/source/strategy）を追加
- `apps/admin/composer.html` / `apps/admin/monitor.html` / `apps/admin/read_model.html` に表示/注記追加
- `docs/ADMIN_UI_DICTIONARY_JA.md` の add-only 追記
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md` の read-model キー add-only
- `tests/phase190` の追加
- `docs/PHASE190_EXECUTION_LOG.md` の追加

## Scope OUT
- policy/cap ロジック変更
- cap 上限値の変更
- 既存UI構造の刷新

## Acceptance / Done
- read-model に lastExecuteReason / capCountMode / capCountSource / capCountStrategy が常在
- monitor/read_model/composer で「上限値ではない」注記が表示
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase190/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE190_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase190.log`
