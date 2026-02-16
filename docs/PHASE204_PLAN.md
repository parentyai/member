# PHASE204_PLAN

## 目的
前週比（7日）の変化表示を read-model と UI に追加し、変化量を判断できるようにする。

## Scope IN
- read-model に weekOverWeek を add-only 追加
- monitor/read-model に前週比の表示を追加
- SSOT の read-model キーを add-only で更新
- Phase204 実行ログの作成

## Scope OUT
- 既存キーの意味変更
- ルート/API 変更
- 送信フロー変更

## Target Files
- `src/usecases/admin/getNotificationReadModel.js`
- `apps/admin/monitor.html`
- `apps/admin/read_model.html`
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase204/phase204_t01_week_over_week_delta.test.js`
- `docs/PHASE204_EXECUTION_LOG.md`

## Acceptance / Done
- weekOverWeek が read-model に常在する
- monitor/read-model で前週比が表示される
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase204/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE204_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase204.log`
