# LINE_DESKTOP_PATROL_ARCHITECTURE

macOS 上の LINE Desktop を対象にした閉域 self-evaluation harness。execute path は local-only MCP server の二系統で構成する。
- API path: existing LINE Messaging API push bridge
- desktop UI path: Codex から呼べる macOS Accessibility + OCR bridge

## Current Scope
- `tools/line_desktop_patrol/` に Python MCP sidecar を隔離する
- `schemas/line_desktop_patrol_*.schema.json` で policy / trace / scenario / proposal 契約を固定する
- `tools/line_desktop_patrol/read_repo_runtime_state.js` で repo-side の global runtime state を read-only 取得する
- `tools/line_desktop_patrol/send_text_bridge.js` で existing `lineClient.pushMessage` へ guarded execute する
- `tools/line_desktop_patrol/desktop_ui_bridge.swift` で LINE Desktop を user-account として操作する
- `tools/line_desktop_patrol/desktop_ui_bridge.js` で transcript / evaluator / proposal loop を統合する
- `tools/line_desktop_patrol/run_local_mcp_tool.js` で local one-shot 実行と `desktop-self-test` の安全順フローを提供する

## Boundaries
- Python sidecar:
  - policy load
  - runtime state read
  - trace store
  - proposal queue
  - stdio MCP transport
  - guarded tool dispatch (`get_runtime_state`, `list_allowed_targets`, `send_text`, `desktop_readiness`, `desktop_snapshot`, `desktop_run_conversation_loop`)
- Node bridge:
  - git sha
  - Firestore project id resolution
  - `system_flags/phase0`
  - phase48 automation config
  - LINE Messaging API push bridge
  - local MCP one-shot runner
  - readiness-first desktop self-test flow
- Swift bridge:
  - AX context resolution for LINE Desktop
  - sidebar target selection
  - header OCR verification
  - composer send + transcript capture
- Existing runtime:
  - webhook / notification / admin routes are unchanged
  - send path reuses existing kill switch semantics via `src/infra/lineClient.js`

## Safe Defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- `require_target_confirmation=true`
- sample targets are whitelist placeholders only and remain `dry_run` only
- proposal queue is append-only and human review remains mandatory

## Execute Guardrails
- execute mode is local-only
- target allowlist is mandatory
- actual `lineUserId` never lives in repo config; it is resolved from `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- desktop UI targets must configure `expected_chat_title` containing `メンバー`
- blocked hours, max runs per hour, failure streak threshold, and global kill switch are enforced before send
- trace/result artifacts are written locally under `artifacts/line_desktop_patrol/`

## Filesystem Contract
- schema root:
  - `schemas/line_desktop_patrol_policy.schema.json`
  - `schemas/line_desktop_patrol_trace.schema.json`
  - `schemas/line_desktop_patrol_scenario.schema.json`
  - `schemas/line_desktop_patrol_proposal.schema.json`
- sidecar root:
  - `tools/line_desktop_patrol/`
- local artifacts:
  - `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
  - `artifacts/line_desktop_patrol/runs/<run_id>/result.json`
  - `artifacts/line_desktop_patrol/proposals/queue.jsonl`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`
  - `tmp/line_desktop_patrol_latest.json`

## Admin Read Surface
- admin quality patrol remains read-only and can surface add-only `desktopPatrolSummary.promotion.latestArtifactKind`, `desktopPatrolSummary.promotion.latestArtifactStatus`, `desktopPatrolSummary.promotion.latestDraftPrRef`, and `desktopPatrolSummary.promotion.updatedAt`
- admin quality patrol can also surface add-only `desktopPatrolSummary.promotionReview.latestReviewArtifactKind`, `desktopPatrolSummary.promotionReview.branchName`, `desktopPatrolSummary.promotionReview.worktreeRef`, `desktopPatrolSummary.promotionReview.patchDraftRef`, `desktopPatrolSummary.promotionReview.codeEditTaskRef`, `desktopPatrolSummary.promotionReview.codeApplyDraftRef`, and `desktopPatrolSummary.promotionReview.codeReviewPacketRef`
- admin quality patrol can also surface add-only `desktopPatrolSummary.promotionApproval.approvalStage`, `desktopPatrolSummary.promotionApproval.approvalStatus`, `desktopPatrolSummary.promotionApproval.latestDraftPrRef`, `desktopPatrolSummary.promotionApproval.worktreeRef`, `desktopPatrolSummary.promotionApproval.patchRequestRef`, `desktopPatrolSummary.promotionApproval.codeApplyTaskRef`, `desktopPatrolSummary.promotionApproval.codeApplySignoffRef`, `desktopPatrolSummary.promotionApproval.codeApplyRecordRef`, `desktopPatrolSummary.promotionApproval.validationCommandCount`, `desktopPatrolSummary.promotionApproval.candidateEditCount`, `desktopPatrolSummary.promotionApproval.operatorInstructionCount`, `desktopPatrolSummary.promotionApproval.nextCommand`, `desktopPatrolSummary.promotionApproval.remainingCommands`, `desktopPatrolSummary.promotionApproval.remainingCommandCount`, and `desktopPatrolSummary.promotionApproval.nextAction`
- admin quality patrol can also surface add-only `desktopPatrolSummary.promotionBatch.batchRunId`, `desktopPatrolSummary.promotionBatch.completionStatus`, `desktopPatrolSummary.promotionBatch.queuedProposalCount`, `desktopPatrolSummary.promotionBatch.patchDraftReadyCount`, `desktopPatrolSummary.promotionBatch.blockedCaseIds`, `desktopPatrolSummary.promotionBatch.nextAction`, and `desktopPatrolSummary.promotionBatch.updatedAt`
- promotion summary is derived from the latest local promotion artifact only and does not mutate the queue or runtime state
- promotion review summary is derived from the latest local promotion artifact plus sibling review bundles only and does not mutate the queue or runtime state
- promotion approval summary is derived from the latest local promotion artifact plus sibling approval bundles only
- `POST /api/admin/quality-patrol/desktop-approval/plan` derives a two-phase operator plan (`planHash` / `confirmToken`) from the latest approval lane without mutating the queue
- `POST /api/admin/quality-patrol/desktop-approval/execute` is local-only, uses `managedFlowGuard + planHash + confirmToken`, and advances exactly one approval artifact stage
- promotion batch summary is derived from the latest local self-improvement summary artifact only and does not mutate the queue or runtime state

## Non-goals
- no always-on scheduler
- no Firestore write path from patrol itself
- no broad server-side auto-apply path
