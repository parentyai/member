# PHASE202_PLAN

## 目的
操作前に plan 対象人数を表示し、影響範囲を判断できるようにする。

## Scope IN
- composer で plan 対象人数を固定表示
- ops の plan count 表示をテストで固定
- UIラベルを辞書 add-only で追加
- Phase202 実行ログの作成

## Scope OUT
- plan/execute ロジック変更
- read-model 変更
- 新規API追加

## Target Files
- `apps/admin/composer.html`
- `apps/admin/ops_readonly.html`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase202/phase202_t01_plan_target_count_display.test.js`
- `docs/archive/phases/PHASE202_EXECUTION_LOG.md`

## Acceptance / Done
- plan 対象人数が composer で固定表示される
- ops の plan count 表示が維持される（テストで固定）
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase202/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/archive/phases/PHASE202_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase202.log`
