# Phase583 Plan

## Goal
dashboard/monitor に `fallbackOnEmpty` を追加し、fallback 制御面を phase4/phase5 と横並びにする。

## Scope
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osDashboardKpi.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/monitorInsights.js`
- `/Users/parentyai.com/Projects/Member/tests/phase583/*`

## Non-Goals
- KPI 定義変更
- monitor の出力項目削除

## Contract
- query: `fallbackOnEmpty=true|false`
- 未指定時 `true`
- 不正値は `400`
- 既存 `fallbackUsed/fallbackBlocked/fallbackSources` は維持

## Acceptance
- dashboard/monitor で `fallbackOnEmpty` が解析される
- 空データ由来 fallback のみ抑止可能

