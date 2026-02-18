# PHASE249_PLAN

## Purpose
- ユーザー向け導入を guide-only に限定し、FAQナビ/質問整形/チェックリスト誘導以外を fail-closed で固定する。

## Scope IN
- guide-only mode の契約再固定
- personalization allow-list（locale/servicePhase）維持
- phase249 テスト追加

## Scope OUT
- 自由相談チャットの解禁

## Acceptance / Done
- guide-only 以外が block される
- personalization allow-list 外入力が block される
- `node --test tests/phase249/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase249/*.test.js`
- `npm run test:docs`
- `npm test`
