# PHASE256_PLAN

## Goal
City Pack source audit run detail API/UI に証跡件数 limit を追加し、運用時の過大レスポンスを抑制する。

## Scope
- API: `GET /api/admin/city-pack-source-audit/runs/:runId?limit=`
- UI: `/admin/app` run detail に表示件数入力を追加
- UI: run detail fetch を limit 付きに変更
- Dictionary: limit ラベル/tooltipを add-only 追加
- Test: phase256 契約テスト追加

## Out of Scope
- source audit 判定ロジック変更
- Evidence Viewer API 変更
- City Pack policy 判定変更

## Done Criteria
- run detail API が `limit` を受け取り `evidenceLimit` を返す。
- `/admin/app` から run detail limit を指定できる。
- `npm run test:docs` / `node --test tests/phase256/*.test.js` / `npm test` が PASS。

## Rollback
- `git revert <phase256 merge commit>`
