# PHASE246_PLAN

## Purpose
- FAQ BLOCK UX 契約を固定し、答えない時でも安全導線（fallbackActions/suggestedFaqs）を保証する。

## Scope IN
- BLOCK payload の `fallbackActions` / `suggestedFaqs<=3` 契約固定
- UI 表示で直URL sourceId を除外
- phase246 テスト追加

## Scope OUT
- FAQ自由回答の導入

## Acceptance / Done
- BLOCK payload が安全導線を必ず返す
- UI で direct URL が表示されない
- `node --test tests/phase246/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase246/*.test.js`
- `npm run test:docs`
- `npm test`
