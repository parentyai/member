# PHASE33_PLAN

## 対象フェーズ
- Phase33

## Phase33の目的
Opsの nextAction を「実際の送信・タスク更新」に変換し、実行結果を監査可能に記録する。
実行は自動/半自動のみとし、人間の判断追加は行わない。

## Scope In
- usecase: `src/usecases/phase33/executeOpsNextAction.js`
- 対応 action:
  - NO_ACTION（logのみ）
  - RERUN_MAIN（既存 workflow trigger）
  - FIX_AND_RERUN（ops note + todo/checklist hook）
  - STOP_AND_ESCALATE（通知テンプレ送信）
- 実行結果を decision_logs に append（subjectType=ops_execution）
- ガード: readiness NOT_READY の実行禁止 / 同一 decisionLogId 二重実行禁止
- API: POST /api/phase33/ops-decision/execute
- tests 追加

## Scope Out
- LINEアプリ案（永久にOut）
- 既存PhaseのAPI/DB/Docs/Testsの破壊
- UI実装

## Execution Snapshot（固定）
{
  "execution": {
    "action": "FIX_AND_RERUN",
    "result": "SUCCESS",
    "sideEffects": ["todo_created"],
    "executedAt": "SERVER_TIMESTAMP"
  }
}

## 通知テンプレ（STOP_AND_ESCALATE）
既存 Notification 基盤を使用。以下の env でテンプレ指定（未設定時は通知送信をskipし、executionに記録）。
- OPS_ESCALATE_LINK_REGISTRY_ID
- OPS_ESCALATE_SCENARIO_KEY
- OPS_ESCALATE_STEP_KEY
- OPS_ESCALATE_TITLE
- OPS_ESCALATE_BODY
- OPS_ESCALATE_CTA_TEXT
- OPS_ESCALATE_TARGET_REGION (optional)
- OPS_ESCALATE_TARGET_MEMBERS_ONLY (optional: 1/0)
- OPS_ESCALATE_TARGET_LIMIT (optional)

## Tasks
- T01: executeOpsNextAction usecase + guards
- T02: route追加（/api/phase33/ops-decision/execute）
- T03: tests（actions/二重実行/NOT_READY）
- T04: docs（PLAN/EXECUTION_LOG）

## Done定義（全てYESでCLOSE）
- Ops判断 → 実行 がコードで一本道
- tests追加 & npm test PASS
- main CI success
- docs append-only

## Rollback
- revert PR
