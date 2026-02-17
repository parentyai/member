# PHASE211_PLAN

## 目的
- `master` 画面で Ops 説明（PhaseLLM2）と次アクション候補（PhaseLLM3）を管理者が検証できる導線を追加する。

## Scope IN
- `apps/admin/master.html` に LLM Ops 検証セクションを追加
- `/api/phaseLLM2/ops-explain` 呼び出しを UI へ接続
- `/api/phaseLLM3/ops-next-actions` 呼び出しを UI へ接続
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- Ops/NextAction API 仕様変更
- LLM schema / guard 変更
- DB/監査ロジック変更

## Target Files
- `apps/admin/master.html`
- `tests/phase211/phase211_master_llm_ops_ui.test.js`
- `docs/PHASE211_EXECUTION_LOG.md`

## Acceptance / Done
- master UI から lineUserId 指定で Ops 説明を取得できる
- master UI から lineUserId 指定で次候補を取得できる
- lineUserId 未入力時は UI 側で拒否する
- 結果 JSON を画面表示できる
- `npm test` PASS
- `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase211/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE211_EXECUTION_LOG.md`
