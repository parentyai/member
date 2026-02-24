# PHASE254_PLAN

## Goal
City Pack source audit の run 詳細を運用画面で判読しやすくし、run から Evidence Viewer へ直接ドリルダウンできる導線を add-only で固定する。

## Scope
- UI: `/admin/app` の City Pack 実行結果をテーブル化（証跡ID/結果/確認日時/HTTP/表示）
- UI: run 詳細選択時に Evidence Viewer を自動表示
- UX: trace 未選択時は警告トーストを表示
- Dictionary: run detail 用キー add-only 追加
- Test: phase254 契約テスト追加

## Out of Scope
- run detail API の意味変更
- source audit job 判定ロジック変更
- City Pack policy / 通知送信判定変更

## Done Criteria
- `/admin/app` で run 行選択時に run 詳細テーブルが表示される。
- run 詳細の証跡行から Evidence Viewer を開ける。
- trace 未選択で「追跡IDで証跡を開く」を押すと警告トーストが出る。
- `npm run test:docs` / `node --test tests/phase254/*.test.js` / `npm test` が PASS。

## Rollback
- `git revert <phase254 merge commit>`
