# PHASE187_PLAN

## Phase187の目的
通知ReadModelのUI参照キーをSSOTとして固定し、契約境界を明確化する。

## Scope IN
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md` に read-model のUI参照キーを add-only で追記
- `tests/phase187` に read-model key 常在保証のテスト追加
- `docs/archive/phases/PHASE187_PLAN.md` / `docs/archive/phases/PHASE187_EXECUTION_LOG.md` の新規追加

## Scope OUT
- read-model の意味変更
- UI構造変更
- 既存SSOTの書き換え

## Acceptance / Done
- SSOTに read-model UI参照キーが add-only で存在
- `tests/phase187` PASS
- `npm test` / `npm run test:docs` PASS
- CI（audit + deploy dry-run）PASS
- working tree CLEAN

## Verification Commands
- `node --test tests/phase187/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/archive/phases/PHASE187_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>.log`

## Risks
- SSOTの追記範囲が広すぎると契約が肥大化する
- `verify_docs` が辞書/HTML不整合でFAIL

## Rollback
- Phase187 PR を `git revert`
