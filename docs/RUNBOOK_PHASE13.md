# Phase13 Runbook (Operations Handoff)

## Purpose
- 通常運用で判断固定を維持する

## Phase13 実テスト開始
- 実行日時: 2026-01-31 16:40
- 実行者: Nobuhide Shimamura
- main SHA: ccdee2f90d3ca3cba9e92d0775ca8e2fb5e0efcc
- ステータス: STARTED

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
