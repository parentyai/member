# Architecture Phase2

## 境界
- 既存の entrypoint: src/index.js のみ
- Phase2 は既存の公開範囲/権限/CI/CD を変更しない

## レイヤー責務
UI → API → Usecase → Repo → Firestore

- routes: 入力検証 / レスポンス整形のみ
- usecases: 実行順序・冪等性・dry-run 制御
- repos: Firestore CRUD のみ

## 自動化フロー（最小）
1) /admin/phase2/automation/run に POST
2) route が `fallbackMode=allow|block` を add-only で検証し、`payload.outcome` と `x-member-outcome-*` header を整える
3) usecase が runId / targetDate / dryRun を検証
4) read repo で events / users / checklists / user_checklists を取得
5) 集計結果を生成
6) dry-run の場合は書き込みせず summary 返却
7) 実行時は read-model へ upsert + run log を保存

## 可観測性
- run log に件数/所要時間/結果を記録
- dry-run は書き込み禁止、レスポンスに summary のみ

## 冪等性
- runId を冪等キーとして run log に保存
- read-model は決定的 docId で upsert
