# PHASE243_PLAN

## Purpose
- KB スキーマを add-only で厳格化し、`version` 追加互換と不正記事 fail-closed を固定する。

## Scope IN
- `faqArticlesRepo` に `version/versionSemver` 互換解決を追加
- `riskLevel/allowedIntents/status` の正規化
- 不正スキーマ記事の検索除外
- phase243 テスト追加

## Scope OUT
- LLM 出力仕様変更
- route 追加

## Acceptance / Done
- `version` 優先、`versionSemver` fallback が成立
- 不正 schema 記事が検索対象外
- `node --test tests/phase243/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase243/*.test.js`
- `npm run test:docs`
- `npm test`
