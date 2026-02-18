# PHASE252_PLAN

## Goal
City Pack 監査実行の可観測性を `/admin/app` で完結させるため、実行履歴 API と UI パネルを add-only で追加する。

## Scope
- API: `GET /api/admin/city-pack-source-audit/runs?limit=`
- UI: City Pack 操作パネルに実行履歴テーブル/要約を追加
- Test: phase252 で route/UI wiring 契約を固定

## Out of Scope
- 監査ジョブの判定ロジック変更
- 既存 City Pack review/evidence API の意味変更
- 既存通知送信フローの変更

## Design
- `source_audit_runs` から最新 run を取得し、`RUNNING/OK/WARN` に正規化して返却。
- `/admin/app` は実行履歴を表示し、`監査ジョブ実行` 後に自動更新する。
- 監査閲覧 API へのアクセスは既存 `requireAdminToken` の fail-closed を維持。

## Done Criteria
- `GET /api/admin/city-pack-source-audit/runs` が admin token 必須で動作する。
- `/admin/app` に実行履歴パネル（更新ボタン・要約・表）が表示される。
- `npm run test:docs` / `node --test tests/phase252/*.test.js` / `npm test` が PASS。

## Rollback
- `git revert <phase252 merge commit>`

