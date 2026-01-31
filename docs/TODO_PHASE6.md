# TODO Phase6 Ledger

## Task Template
- Purpose:
- Completion Criteria:
- Dependencies:
- Edit Files:
- Tests:
- Evidence:
- Risks:

## Backlog

### P6-001: Phase6 SSOT / Scope 固定（Design Pending）
- Purpose: Phase6 の目的・スコープ・非目的を確定する
- Completion Criteria: docs/SSOT_PHASE6.md が作成され、レビュー可能である
- Dependencies: Phase5 CLOSE
- Edit Files: docs/SSOT_PHASE6.md
- Tests: N/A (docs-only)
- Evidence: PR #89 (docs-only PREPARE), 2026-01-31
- Risks: SSOTが未確定のまま実装が進む
- Type: docs-only

### P6-002: Phase6 実装境界・運用境界の定義（Design Pending）
- Purpose: 実装/運用/判断の境界を明文化する
- Completion Criteria: ARCHITECTURE_PHASE6.md が作成され、境界が明記されている
- Dependencies: P6-001
- Edit Files: docs/ARCHITECTURE_PHASE6.md
- Tests: N/A (docs-only)
- Evidence: PR #89 (docs-only PREPARE), 2026-01-31
- Risks: 責務の曖昧化による逸脱
- Type: docs-only

### P6-003: Phase6 READ ONLY 最小API追加（Design Pending）
- Purpose: Phase6 における READ ONLY 実装の最小単位を1点追加する
- Completion Criteria: /api/phase6/member/summary が READ ONLY で応答し、単体テストがPASSする
- Dependencies: P6-001, P6-002
- Implementation Target: /api/phase6/member/summary
- Scope: 既存 Phase5 summary / ops flags を参照するのみ（write / mutation / background job なし）
- Edit Files: src/routes/phase6/<name>.js, src/usecases/phase6/<name>.js, tests/phase6/<name>.test.js
- Tests: node --test tests/phase6/<name>.test.js
- Evidence: 非対象（実テスト開始に影響しない）
- Risks: 実装対象が曖昧なまま進む
- Type: code-task

## In Progress

## Done
