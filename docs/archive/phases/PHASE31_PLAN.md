# PHASE31_PLAN

## 対象フェーズ
- Phase31

## Phase31の目的
Opsが日々やる3操作（list / detail / submit）を、read-only HTML（ops_readonly.html）から実行できる状態にする。
既存Phase25-30のAPI互換を維持しつつ、UIからの運用導線をSSOT化する。

## Scope In
- ops_readonly.html に Ops Console list/detail/submit セクション追加
- list: GET /api/phase26/ops-console/list
- detail: GET /api/phase25/ops/console
- submit: POST /api/phase25/ops/decision（submitOpsDecision）
- 追加UIは textContent ベースで描画（XSS最小対策）
- tests 追加（HTMLの構造/関数の存在）
- docs: PHASE31_PLAN / PHASE31_EXECUTION_LOG

## Scope Out
- LINEアプリ案（永久にOut）
- 認証/権限制御の変更
- UIデザイン改善/SPA化/フロントFW導入
- paginationの本実装（次ページ取得）
- Ops推薦ロジックの変更

## Tasks
- T01: ops_readonly に list/detail/submit セクション追加
- T02: submit用APIルート追加（/api/phase25/ops/decision）
- T03: Phase31テスト追加
- T04: docs更新（PLAN/EXECUTION_LOG）

## Done定義（全てYESでCLOSE）
- ops_readonly から list/detail/submit が可能（コード上）
- 既存API互換を壊さない
- tests追加 & npm test PASS
- PLAN/EXECUTION_LOGが存在し、EXECUTION_LOGに main SHA と CI URL を記録
- main CI success 証跡を取得

## Rollback
- revert PR
