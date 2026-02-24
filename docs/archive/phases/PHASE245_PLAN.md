# PHASE245_PLAN

## Purpose
- disclaimer の用途固定を維持しつつ、表示監査ログ（surface付き）を全 LLM usecase で統一する。

## Scope IN
- FAQ/Ops/NextAction で `llm_disclaimer_rendered` を記録
- payloadSummary に `surface` を add-only 追加
- phase245 テスト追加

## Scope OUT
- disclaimer 文言の意味変更

## Acceptance / Done
- 3 usecase で disclaimer 監査が残る
- `surface` が監査 payload に含まれる
- `node --test tests/phase245/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase245/*.test.js`
- `npm run test:docs`
- `npm test`
