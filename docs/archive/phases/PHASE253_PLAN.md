# PHASE253_PLAN

## Goal
City Pack source audit 実行履歴から run 詳細（evidence一覧/trace）へドリルダウンできる運用導線を add-only で追加する。

## Scope
- API: `GET /api/admin/city-pack-source-audit/runs/:runId`
- Repo: `sourceEvidenceRepo.listEvidenceByTraceId` 追加
- UI: `/admin/app` City Pack 操作パネルに trace drilldown 導線追加
- Test: phase253 契約テスト追加

## Out of Scope
- 監査ジョブ実行ロジック変更
- City Pack policy 判定変更
- 既存通知送信フロー変更

## Done Criteria
- run detail API が admin token 必須で `run + evidences` を返す。
- `/admin/app` で run 行クリック時に詳細が表示される。
- `追跡IDで証跡を開く` で audit pane へ遷移できる。
- `npm run test:docs` / `node --test tests/phase253/*.test.js` / `npm test` が PASS。

## Rollback
- `git revert <phase253 merge commit>`

