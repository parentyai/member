# Phase265 Plan

## Goal
- City Pack拡張1〜12の実装順と契約を docs で先に固定し、以降の複数PRを壊さない順序で進める。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/SSOT_CITY_PACK_EXTENSIONS_1_12.md`（新規）
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`（add-only導線）
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`（add-only: planned section）
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE265_PLAN.md`（本書）
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE265_EXECUTION_LOG.md`（実行ログ）

## Out of scope
- City Pack runtime実装（repo/usecase/route/UI）
- 新規API追加
- 既存SSOT内容の書き換え

## Acceptance
- `SSOT_CITY_PACK_EXTENSIONS_1_12.md` が追加され、拡張1〜12の再編・依存・PR順が固定される
- `SSOT_INDEX.md` に導線が add-only で追加される
- `DATA_MAP.md` に planned add-only 拡張欄が追加される
- `npm run test:docs` と `npm test` が PASS する

## Rollback
- PR単位の `git revert` で切戻し
