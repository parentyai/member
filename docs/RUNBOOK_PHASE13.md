# Phase13 Runbook (Operations Handoff)

## Purpose
- 通常運用で判断固定を維持する

## Phase13 実テスト開始
- 実行日時: 2026-01-31 16:40
- 実行者: Nobuhide Shimamura
- main SHA: ccdee2f90d3ca3cba9e92d0775ca8e2fb5e0efcc
- ステータス: STARTED

## Phase13 実テスト結果
- 実行日時: 2026-01-31 16:47
- 実行者: Nobuhide Shimamura
- main SHA: ad90e8a5664578caa513cf91b3b08d155e052553
- 対象URL: https://member-pvxgenwkba-ue.a.run.app/admin/notifications/new
- 操作: 開いただけ
- 結果: 403 Forbidden
- 判定: FAIL
- 実行日時: 2026-02-01 01:26:07 UTC
- 実行者: Nobuhide Shimamura
- main SHA: 63057d40289f9f984b0f6276df8ffc3fdaaf9b4e
- 対象URL: https://member-pvxgenwkba-ue.a.run.app/admin/ops
- 操作: ブラウザでアクセス
- 結果: 200 OK
- 判定: PASS（管理UI HTML 到達）

## Phase13 実テスト判定
- 管理API（/admin/implementation-targets）: PASS
- 管理UI（/admin/ops）: PASS
- ミニアプリ／通知送信: Phase13 対象外
- 総合判定: PASS

## 403 切り分け（事実ベース）
- 認証必須: YES（deploy.yml に `--no-allow-unauthenticated` が設定されている）
- 認証方式: Cloud Run IAM（Authorization: Bearer の認証付きリクエスト）
- 未認証時の期待挙動: 403 Forbidden
- 正常系入口: Cloud Run URL に認証付きアクセス
  - 例: `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/admin/notifications/new`

## 管理UI 正規アクセス手順（Cloud Run IAM）
- 正規ルート: Cloud Run 直URLに Bearer トークン付与（ブラウザ未認証アクセス不可）
- 利用可能な管理UI: `/admin/ops`（ops_readonly.html）、`/admin/review`（review.html）
- `/admin/notifications/new` はUIファイルが存在しないため、管理UI入口として使用しない

手順（人間オペレーター）
1) gcloud ログイン（未実施の場合のみ）
   - `gcloud auth login`
2) Bearer トークン取得とアクセス
   - `TOKEN=$(gcloud auth print-identity-token)`
   - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/ops`
3) 実装対象一覧の参照（必要時）
   - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/implementation-targets`

## Daily
- API: `${PUBLIC_BASE_URL}/admin/implementation-targets`
  - 配列 / length=1 / id=CO1-D-001-A01 / status=IN
- UI: `${PUBLIC_BASE_URL}/admin/ops`
  - Implementation Targets が1件表示

## Weekly
- CI: `tests/phase12/implementationTargetsAcceptance.test.js` が PASS

## Incident
- 期待値不一致 / API 500 / UI表示不可
  - 直近PRを確認
  - revert 実施

## Rollback
- 該当PRの revert のみ

## Phase13 CLOSE 固定
- Phase13 状態: CLOSED
- CLOSE条件:
  - 管理API /admin/implementation-targets: PASS
  - 管理UI /admin/ops: PASS（200 OK）
  - npm ci: PASS
  - GO_SCOPE UNKNOWN: 0
- 再解釈禁止: Phase13 の再判断・再評価は禁止
