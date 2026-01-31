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

## 403 切り分け（事実ベース）
- 認証必須: YES（deploy.yml に `--no-allow-unauthenticated` が設定されている）
- 認証方式: Cloud Run IAM（Authorization: Bearer の認証付きリクエスト）
- 未認証時の期待挙動: 403 Forbidden
- 正常系入口: Cloud Run URL に認証付きアクセス
  - 例: `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/admin/notifications/new`

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
