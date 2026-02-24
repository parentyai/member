# PHASE201_PLAN

## 目的
状態駆動カードを既存データで反映し、健康状態/優先度の可視化を固定する。

## Scope IN
- ops/monitor/read-model の状態サマリーを既存キーで更新
- 状態表示ラベルを辞書 add-only で追加
- Phase201 実行ログの作成

## Scope OUT
- read-model ロジック変更
- API変更
- 新規キー追加

## Target Files
- `apps/admin/ops_readonly.html`
- `apps/admin/monitor.html`
- `apps/admin/read_model.html`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/archive/phases/PHASE201_EXECUTION_LOG.md`

## Acceptance / Done
- 状態サマリーが既存データで更新される
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase201/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/archive/phases/PHASE201_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase201.log`
