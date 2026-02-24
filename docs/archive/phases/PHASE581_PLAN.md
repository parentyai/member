# Phase581 Plan

## Goal
phase5 summary/state に `fallbackOnEmpty` を add-only で導入し、phase4 と同じ制御面に揃える。

## Scope
- `/Users/parentyai.com/Projects/Member/src/routes/phase5Ops.js`
- `/Users/parentyai.com/Projects/Member/src/routes/phase5State.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/phase5/getUsersSummaryFiltered.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/phase5/getNotificationsSummaryFiltered.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/phase5/getUserStateSummary.js`
- `/Users/parentyai.com/Projects/Member/tests/phase581/*`

## Non-Goals
- 既存レスポンスキー削除
- fallbackMode 既定値変更

## Contract
- query: `fallbackOnEmpty=true|false`
- 未指定時 `true`（既存互換）
- 不正値は `400`

## Acceptance
- phase5 ops/state 3 経路で `fallbackOnEmpty` が利用可能
- `fallbackMode=block` 契約を維持

