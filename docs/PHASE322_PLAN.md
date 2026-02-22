# PHASE322_PLAN

## 目的
`phase2` automation の events 読み取りを週次 bounded range query 優先へ収束し、fallback を維持したまま read path の負荷と drift を抑える。

## スコープ
- `src/usecases/phase2/runAutomation.js`
- `src/routes/admin/phase2Automation.js`
- `tests/phase322/*`（新規）
- `docs/SSOT_INDEX.md`

## 受入条件
- `runPhase2Automation` が target week の `listEventsByCreatedAtRange` を優先利用する。
- range 0件時のみ `listAllEvents` fallback を使う互換設計を維持する。
- `analyticsLimit`（任意）を受け付け、summary に readPath を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase322/*.test.js tests/phase2/runAutomation.test.js` が通る。
