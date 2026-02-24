# PHASE322_EXECUTION_LOG

## 実施内容
- `runPhase2Automation` の events 読み取りを週次 range-first に変更。
  - primary: `listEventsByCreatedAtRange({ fromAt, toAt, limit })`
  - fallback: `listAllEvents({ limit })`（0件時のみ）
- `analyticsLimit`（任意入力）を追加し、`summary.readPath` に `analyticsLimit/eventsSource` を記録。
- `phase2Automation` route が `analyticsLimit` を usecase へ透過するよう更新。
- phase322 テストを追加。

## 検証コマンド
- `node --test tests/phase322/*.test.js tests/phase2/runAutomation.test.js`
- `npm run cleanup:generate`
- `npm run repo-map:generate`
- `npm run test:docs`
- `npm test`

## 結果
- PASS（ローカル検証）
