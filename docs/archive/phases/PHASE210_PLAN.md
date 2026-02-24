# PHASE210_PLAN

## 目的
- `master` 画面で FAQ の LLM 応答を管理者が安全に検証できる導線を追加する。

## Scope IN
- `apps/admin/master.html` に LLM FAQ 検証セクションを追加
- `/api/admin/llm/faq/answer` 呼び出しを UI へ接続
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- FAQ API 仕様の変更
- KB 検索ロジック変更
- LLM schema / guard の変更

## Target Files
- `apps/admin/master.html`
- `tests/phase210/phase210_master_llm_faq_ui.test.js`
- `docs/archive/phases/PHASE210_EXECUTION_LOG.md`

## Acceptance / Done
- master UI から FAQ質問を送信できる
- 質問未入力時は UI 側で拒否
- 結果 JSON を画面に表示できる
- `npm test` PASS
- `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase210/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/archive/phases/PHASE210_EXECUTION_LOG.md`
