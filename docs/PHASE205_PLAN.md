# PHASE205_PLAN

## 目的
plan 段階で抑制数（capBlockedCount）を提示し、送信影響の誤認を防ぐ。

## Scope IN
- planNotificationSend に capBlockedCount を add-only 追加
- composer に抑制数（plan）を固定表示
- SSOT に plan 出力のキーを add-only 追記
- Phase205 実行ログの作成

## Scope OUT
- 送信フローの意味変更
- 既存capロジックの変更
- UI構造の刷新

## Target Files
- `src/usecases/adminOs/planNotificationSend.js`
- `apps/admin/composer.html`
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase205/phase205_t01_plan_cap_blocked_count.test.js`
- `docs/PHASE205_EXECUTION_LOG.md`

## Acceptance / Done
- plan で capBlockedCount が返る
- composer で抑制数（plan）が固定表示される
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase205/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/PHASE205_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase205.log`
