# TODO Phase12 Ledger

## Done
- P12-001: Implementation Targets Registry
  - Purpose: 実装対象を固定する
  - Completion Criteria: 固定レジストリが存在する
  - Dependencies: Phase11 計画
  - Edit Files: src/domain/implementationTargets.js
  - Tests: tests/phase12/implementationTargets.test.js
  - Evidence: src/domain/implementationTargets.js, tests/phase12/implementationTargets.test.js
  - Risks: 対象増加

- P12-002: Implementation Targets API
  - Purpose: 実装対象一覧の参照 API を提供する
  - Completion Criteria: GET /admin/implementation-targets が存在
  - Dependencies: P12-001
  - Edit Files: src/routes/admin/implementationTargets.js, src/index.js
  - Tests: tests/phase12/implementationTargetsApi.test.js
  - Evidence: src/routes/admin/implementationTargets.js, tests/phase12/implementationTargetsApi.test.js
  - Risks: 仕様逸脱

- P12-003: Read-only UI
  - Purpose: 管理UIに参照導線を追加する
  - Completion Criteria: /admin/ops に表示がある
  - Dependencies: P12-002
  - Edit Files: apps/admin/ops_readonly.html
  - Tests: tests/phase12/implementationTargetsUi.test.js
  - Evidence: apps/admin/ops_readonly.html, tests/phase12/implementationTargetsUi.test.js
  - Risks: 誤操作

- P12-004: Acceptance Guard
  - Purpose: 判断劣化検知の受入検証を追加する
  - Completion Criteria: 受入検証テストが存在
  - Dependencies: P12-001
  - Edit Files: tests/phase12/implementationTargetsAcceptance.test.js
  - Tests: tests/phase12/implementationTargetsAcceptance.test.js
  - Evidence: tests/phase12/implementationTargetsAcceptance.test.js
  - Risks: 判断劣化未検知

## In Progress
- None

## Backlog
- None
