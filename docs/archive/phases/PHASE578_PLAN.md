# PHASE578_PLAN

## 目的
新規導入した `AGENTS.md` を運用ゲートに組み込み、実行規範の逸脱を `test:docs` で検知できる状態に固定する。

## スコープ
- `tools/verify_docs.js`
- `tests/phase578/*`
- `docs/archive/phases/PHASE578_PLAN.md`
- `docs/archive/phases/PHASE578_EXECUTION_LOG.md`
- `docs/SSOT_INDEX.md`

## 受入条件
- `AGENTS.md` の必須見出し/必須キーワード不足を `verify_docs` が検知する。
- `tests/phase578` が AGENTS 規範と docs gate 実装の契約を固定する。
- `npm run test:docs` / `node --test tests/phase578/*.test.js` / `npm test` が通る。
