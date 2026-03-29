# RUNBOOK_LINE_DESKTOP_PATROL

Local-only runbook for the LINE patrol MCP harness.

## Preconditions
- test accounts / whitelist targets only
- local policy override path is prepared and pointed to by `LINE_DESKTOP_PATROL_POLICY_PATH`
- or `tools/line_desktop_patrol/config/policy.local.json` exists and is auto-loaded by `run_mcp_server.sh`
- desktop execute targets use `expected_chat_title` that contains `メンバー`
- Codex has macOS Accessibility permission and can activate LINE Desktop
- API-backed execute targets resolve `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- `LINE_CHANNEL_ACCESS_TOKEN` is present only when `send_text` is used
- global kill switch remains the final stop for execute mode

## Validate the harness
1. `npm run line-desktop-patrol:validate`
2. `npm run line-desktop-patrol:state`
3. `npm run line-desktop-patrol:targets`
4. `npm run line-desktop-patrol:desktop-readiness -- --target-alias <alias>`
5. `npm run line-desktop-patrol:desktop-self-test -- --target-alias <alias> --text '...' --send-mode dry_run`
6. `npm run line-desktop-patrol:desktop-self-improvement -- --target-alias <alias> --send-mode execute`
6. `python3 -m compileall tools/line_desktop_patrol/src`
7. `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.mcp_server --manifest`
8. `tools/line_desktop_patrol/run_mcp_server.sh` が起動することを確認

## Execute path
1. set `LINE_DESKTOP_PATROL_POLICY_PATH` to a local override with `enabled=true`
2. keep `require_target_confirmation=true`
3. add `execute` only to the target aliases you explicitly want Codex to use
4. for desktop UI loops, set `expected_chat_title` to the actual LINE group title and keep it scoped to `メンバー`
5. for API-backed sends, export `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
6. start the MCP server with `tools/line_desktop_patrol/run_mcp_server.sh`
7. call one of:
   - `desktop_readiness`
   - `desktop_snapshot`
   - `desktop_run_conversation_loop`
   - `desktop-self-test`
   - `send_text`
8. when using `desktop_run_conversation_loop`:
   - `target_alias`
   - `text`
   - `target_confirmation` equal to the alias
   - `send_mode=execute` only when intentional
   - optional `expected_reply_substrings[]` / `forbidden_reply_substrings[]`
9. for the safest operator flow, prefer `desktop-self-test`, which aborts before send when `desktop_readiness.ready` is not true
10. for the fixed self-improvement loop, prefer `desktop-self-improvement`, which sends the tracked strategic 10-case batch and writes one aggregated review summary under `artifacts/line_desktop_patrol/self_improvement_runs/<batch_run_id>/summary.json`
11. before the first send, confirm the local hourly budget can absorb all 10 execute calls. `desktop-self-improvement` now checks this automatically and fails closed with `stage=budget_preflight` when the remaining budget is too small.
12. when a blocking patrol guard fires mid-batch, later cases are recorded as blocked with the same code instead of pretending they were observed.
13. if local policy keeps `proposal_mode=local_queue`, failed cases enqueue their eval-backed proposals into `artifacts/line_desktop_patrol/proposals/queue.jsonl`
14. if local policy raises `auto_apply_level=patch_draft`, the batch also prepares human-reviewed code edit task bundles under `artifacts/line_desktop_patrol/proposals/promotions/`

## Operator safe sequence
1. `npm run line-desktop-patrol:doctor`
2. `npm run line-desktop-patrol:open-target`
3. `npm run line-desktop-patrol:execute-once`
4. `npm run line-desktop-patrol:loop-execute`
5. `npm run line-desktop-patrol:acceptance-gate`

Debug-only:
- `line-desktop-patrol:send` is outside the formal safe sequence and should stay debug-only.
- `open_target_mismatch_stop` means the `メンバー` target did not verify cleanly; stop before `execute-once`.
- `generic LINE shell only` means `frontmost=true`, `window_name="LINE"`, `visible_item_count=0`, and header OCR empty-or-timeout.

## Expected outputs
- validate command:
  - confirms schema files exist
  - confirms `policy.example.json` stays disabled and dry-run by default
  - confirms sample targets remain `dry_run` only
- state command:
  - prints repo root
  - prints git sha
  - prints Firestore project id resolution
  - prints kill switch / notification caps / automation mode in read-only form
- execute call:
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/result.json`
  - updates `tmp/line_desktop_patrol_latest.json`
  - desktop loops include add-only header OCR evidence and transcript deltas in `result.json`
  - `desktop_readiness` returns `ready`, `accessibilityTrusted`, `lineRunning`, `contextResolved`, and optional title-match evidence
  - `desktop-self-test` returns both `readiness` and `loop` payloads, so operators can confirm the gate that allowed the send
  - `desktop-self-improvement` writes per-case patrol eval artifacts plus one aggregated summary that reports pass/fail by strategic axis, per-case loop error codes, proposal-only next steps for future auto-improvement, and the preflight budget snapshot used to decide whether the 10-case loop could start
  - per-case `promotionResult` fields show whether proposals were skipped, queued, or promoted into human-reviewed patch-draft tasks
  - admin summary surfaces add-only `desktopPatrolSummary.promotion.latestArtifactKind`, `desktopPatrolSummary.promotion.latestArtifactStatus`, `desktopPatrolSummary.promotion.latestDraftPrRef`, and `desktopPatrolSummary.promotion.updatedAt`
  - admin summary also surfaces add-only `desktopPatrolSummary.promotionReview.latestReviewArtifactKind`, `desktopPatrolSummary.promotionReview.branchName`, `desktopPatrolSummary.promotionReview.worktreeRef`, `desktopPatrolSummary.promotionReview.patchDraftRef`, `desktopPatrolSummary.promotionReview.codeEditTaskRef`, `desktopPatrolSummary.promotionReview.codeApplyDraftRef`, and `desktopPatrolSummary.promotionReview.codeReviewPacketRef`
- admin summary also surfaces add-only `desktopPatrolSummary.promotionApproval.approvalStage`, `desktopPatrolSummary.promotionApproval.approvalStatus`, `desktopPatrolSummary.promotionApproval.latestDraftPrRef`, `desktopPatrolSummary.promotionApproval.worktreeRef`, `desktopPatrolSummary.promotionApproval.latestArtifactRef`, `desktopPatrolSummary.promotionApproval.latestPromptRef`, `desktopPatrolSummary.promotionApproval.patchRequestRef`, `desktopPatrolSummary.promotionApproval.codeApplyTaskRef`, `desktopPatrolSummary.promotionApproval.codeApplySignoffRef`, `desktopPatrolSummary.promotionApproval.codeApplyRecordRef`, `desktopPatrolSummary.promotionApproval.validationCommandCount`, `desktopPatrolSummary.promotionApproval.candidateEditCount`, `desktopPatrolSummary.promotionApproval.operatorInstructionCount`, `desktopPatrolSummary.promotionApproval.nextCommand`, `desktopPatrolSummary.promotionApproval.remainingCommands`, `desktopPatrolSummary.promotionApproval.remainingCommandCount`, and `desktopPatrolSummary.promotionApproval.nextAction`
- operator surface can copy `nextCommand`, `remainingCommands`, `latestPromptRef.path`, `latestArtifactRef.path`, `validationCommands`, `operatorInstructions`, `worktreeRef.path`, and operator-visible `candidateEdits[].filePath` without adding new server-side write authority
  - admin quality patrol now also exposes `POST /api/admin/quality-patrol/desktop-approval/plan` and `POST /api/admin/quality-patrol/desktop-approval/execute` for operator-only approval progression
  - execute uses `managedFlowGuard + planHash + confirmToken` and advances exactly one approval artifact step; it remains local-only
  - admin summary also surfaces add-only `desktopPatrolSummary.promotionBatch.batchRunId`, `desktopPatrolSummary.promotionBatch.completionStatus`, `desktopPatrolSummary.promotionBatch.queuedProposalCount`, `desktopPatrolSummary.promotionBatch.patchDraftReadyCount`, `desktopPatrolSummary.promotionBatch.blockedCaseIds`, and `desktopPatrolSummary.promotionBatch.nextAction`

## Stop and rollback
- immediate stop:
  - set the existing global kill switch ON
  - or set `enabled=false` in the local policy override
- local rollback:
  - remove `execute` from target allowlists
  - unset `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- repo rollback:
  - revert the patrol MCP execute-path PR

## Guardrails
- desktop UI control is local-only and limited to targets whose configured title contains `メンバー`
- screenshot retention follows `store_screenshots`; default local policy keeps it off
- no promotion into backlog collections
- patch-draft preparation stays local-only and human-reviewed
- no patrol-originated Firestore write path

## Optional operator check
1. Run `npm run line-desktop-patrol:desktop-readiness -- --target-alias <alias>` and confirm `ready=true`.
2. Run `npm run line-desktop-patrol:desktop-self-test -- --target-alias <alias> --text '...' --send-mode dry_run`.
3. Confirm `tmp/line_desktop_patrol_latest.json` points at the latest run and `result.json` contains header OCR evidence for the `メンバー` target.
4. When the goal is reply quality iteration, run `npm run line-desktop-patrol:desktop-self-improvement -- --target-alias <alias> --send-mode execute` and review the aggregated strategic summary before deciding whether to patch the runtime.
5. If `summary.json` stops at `stage=budget_preflight`, raise the local-only `max_runs_per_hour` just enough for `recentRunCount + 10` and rerun after confirming the target is still the `メンバー` group.
