# PHASE191_PLAN

## 目的
SSOT → ReadModel → UI → Test → CI の閉路保証をテストで固定する。

## Scope IN
- `tests/phase191` に閉路保証テストを追加
- `docs/PHASE191_EXECUTION_LOG.md` の追加

## Scope OUT
- UI構造変更
- read-model ロジック変更
- SSOT の意味変更

## Acceptance / Done
- SSOT_ADMIN_UI_DATA_MODEL の read-model キーが read-model 出力に常在
- monitor/read_model の UI 参照が SSOT キーに一致
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase191/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE191_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase191.log`
