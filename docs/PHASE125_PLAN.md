# PHASE125_PLAN

## Purpose
公開 webhook edge（Cloud Run, `SERVICE_MODE=webhook`）の境界をコードで固定し、LINE webhook 由来イベントをSSOT（Firestore `events`）へ best-effort で追記できる状態にする。

## Scope In
- `SERVICE_MODE=webhook` のとき webhook-only（`/healthz` + `POST /webhook/line` 以外 404）
- LINE webhook payload の `events[]` を Firestore `events` へ append（type=`line_webhook.*` add-only）
- webhook edge で不要な副作用（welcome push 等）をデフォルト抑止（公開面の安全性）

## Scope Out
- 既存APIの互換破壊
- 既存 `events` タイプの意味変更（type追加のみ）
- LLM関連の変更

## Done Definition
- webhook-only がテストで担保されている
- webhook payload から `events` に `line_webhook.*` が追記される（best-effort）
- `npm test` PASS

## Rollback
- revert 実装PR

