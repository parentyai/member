# PHASE209_PLAN

## 目的
- `master` 画面から LLM 機能の status/plan/set を安全に運用できる UI を追加する。

## Scope IN
- `apps/admin/master.html` に LLM 設定ブロック追加
- 既存 API `/api/admin/llm/config/{status,plan,set}` への UI 接続
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- API 仕様変更
- system_flags のデータ構造変更
- LLM provider 実装変更

## Target Files
- `apps/admin/master.html`
- `tests/phase209/phase209_master_llm_config_ui.test.js`
- `docs/archive/phases/PHASE209_EXECUTION_LOG.md`

## Acceptance / Done
- master 画面で LLM 設定の更新/計画/適用 UI が表示される
- plan なし set が UI 側で拒否される
- 既存 confirm token フローを維持
- `npm test` PASS
- `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase209/*.test.js`
- `npm test`
- `npm run test:docs`

## Evidence
- `docs/archive/phases/PHASE209_EXECUTION_LOG.md`
