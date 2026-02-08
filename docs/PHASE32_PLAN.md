# PHASE32_PLAN

## 対象フェーズ
- Phase32

## Phase32の目的
Opsが判断に迷ったとき、LLMが「候補・理由・注意点」を返す状態を作る。
提案は補助のみで強制せず、既存の allowedNextActions / readiness を厳守する。

## Scope In
- usecase: `src/usecases/phase32/suggestOpsDecision.js`
- 入力: ops console snapshot（readiness/userStateSummary/memberSummary/latestDecisionLog/opsState）
- 出力 schema の固定（suggestedNextActions/notes/model/generatedAt）
- LLM adapter 経由の呼び出し（mock可能）
- prompt のコード固定（本書に転記）
- timeout/failure時は suggestedNextActions=[] の graceful degrade
- API: GET /api/phase32/ops-decision/suggest?lineUserId=...
- tests 追加

## Scope Out
- LINEアプリ案（永久にOut）
- LLMによる自動決定/自動送信
- 既存PhaseのAPI/DB/Docs/Testsの破壊

## Prompt（固定）
You are an ops assistant.
Given the ops console snapshot, suggest next actions with rationale and risk.
Rules:
- Do NOT suggest actions outside allowedNextActions.
- If readiness is NOT_READY, only suggest STOP_AND_ESCALATE.
- Suggestions are advisory only.

## Tasks
- T01: suggestOpsDecision usecase + adapter
- T02: route追加（/api/phase32/ops-decision/suggest）
- T03: tests（READY/NOT_READY/LLM failure）
- T04: docs（PLAN/EXECUTION_LOG）

## Done定義（全てYESでCLOSE）
- LLM補助が ops console snapshot から提案を返せる
- allowedNextActions / readiness を超えない
- tests追加 & npm test PASS
- main CI success
- docs append-only

## Rollback
- revert PR
