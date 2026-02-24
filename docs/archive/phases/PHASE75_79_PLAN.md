# PHASE75_79_PLAN

## Purpose
Template versioning / saved segments / run再現性を固定し、plan→execute の再現可能な運用線を強化する。

## Scope In
- Phase75: templates_v (templateKey + version) の保存と取得。
- Phase76: plan/execute の templateVersion 対応。
- Phase77: saved segments (ops_segments) の保存/取得。
- Phase78: ops_readonly に saved segments 連携。
- Phase79: execute runId + planSnapshot + audit snapshot の固定。

## Scope Out
- 既存 templates の移行。
- 自動送信の既定ON化。
- 既存APIの意味変更。

## APIs
- `POST /api/phase67/send/plan` (templateVersion?, segmentKey?, filterSnapshot?)
- `POST /api/phase68/send/execute` (templateVersion/planHash一致必須)
- `POST /api/phase77/segments`
- `GET /api/phase77/segments?status=active`
- `GET /api/phase77/segments/:segmentKey`

## Firestore (append-only)
- `templates_v`: versioned templates
- `ops_segments`: saved segments
- `audit_logs`: plan/execute snapshots

## Tasks
- T01: templates_v repo + tests
- T02: plan/execute templateVersion 対応
- T03: ops_segments repo/usecase/route
- T04: ops_readonly saved segments UI
- T05: runId + planSnapshot audit
- T06: docs/runbooks/tests

## Done Definition
- templateVersion が plan/execute に反映される。
- saved segments が API + UI から利用できる。
- execute が runId/planSnapshot を audit に保存する。
- docs + tests が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
