# Data Map

This document describes what data the Member system stores, where it is stored, and how it is used.

## Scope
- App: Member (Cloud Run services: member / member-webhook / member-track)
- Storage: Firestore + Secret Manager + Cloud Logging

## Primary Identifiers
- `lineUserId`: LINE userId (primary key in Member)
- `memberNumber`: user-provided number (not verified by Member)
- `redacMembershipIdHash`: HMAC-SHA256 of user-declared Redac membership id (not reversible without secret)

## Canonical Naming Authority
- canonical prefix is `redac_*` (legacy `ridac_*` は互換readのみ、new write禁止)
- canonical collection is `ops_states` (legacy `ops_state` は互換readのみ、new write禁止)
- legacy alias を read した場合は `canonical_authority` warning と audit payload (`legacyReadUsed`, `authoritySource`) を残す

## Stored Data (Firestore)
### `users/{lineUserId}`
Purpose: user profile + minimal state needed for operations.

Typical fields (not exhaustive):
- `scenarioKey`, `stepKey`: state for scenario/step routing
- `memberNumber`: user-provided number (string|null)
- `createdAt`: created timestamp
- `memberCardAsset`: member card asset reference (object|null)
- `redacMembershipIdHash`: HMAC hash (string|null)
- `redacMembershipIdLast4`: last 4 digits only (string|null)
- `redacMembershipDeclaredAt`, `redacMembershipDeclaredBy`: declaration timestamp + actor (`user`/`ops`)
- `redacMembershipUnlinkedAt`, `redacMembershipUnlinkedBy`: unlink timestamp + actor (`user`/`ops`)

Notes:
- Plaintext Redac membership id is not stored.

### `redac_membership_links/{redacMembershipIdHash}`
Purpose: enforce uniqueness (one Redac membership id can be linked to only one LINE user).

Fields:
- `redacMembershipIdHash`: HMAC hash (doc id and field)
- `redacMembershipIdLast4`: last 4 digits only
- `lineUserId`: linked LINE user
- `linkedAt`, `linkedBy`: link timestamp + actor (`user`/`ops`)

Compatibility:
- legacy collection `ridac_membership_links` は read fallback のみ。
- write/unlink 実行時は canonical collection (`redac_membership_links`) を authority とし、legacy read 使用時は監査証跡を残す。

### `audit_logs/{id}`
Purpose: append-only audit trail for sensitive operations and decision traces.

Fields:
- `actor`, `action`, `entityType`, `entityId`
- `traceId`, `requestId`
- `payloadSummary` (should not contain plaintext secrets or full membership ids)
- `createdAt`

### `llm_action_logs/{id}` / `faq_answer_logs/{id}` / `conversation_review_snapshots/{id}`
Purpose: LLM runtime quality telemetry and masked conversation review evidence.

Typical fields:
- `llm_action_logs`: route/strategy/readiness/fallback telemetry, template fingerprints, trace linkage, transcript snapshot outcome telemetry (`transcriptSnapshotOutcome`, `transcriptSnapshotReason`, availability booleans, input diagnostics such as `transcriptSnapshotAssistantReplyPresent`, `transcriptSnapshotAssistantReplyLength`, `transcriptSnapshotSanitizedReplyLength`, `transcriptSnapshotBuildAttempted`, `transcriptSnapshotBuildSkippedReason` without raw transcript text)
- `faq_answer_logs`: question hash, matched FAQ ids, saved FAQ / readiness telemetry
- `conversation_review_snapshots`: `lineUserKey`, `traceId`, `requestId`, `routeKind`, `strategy`, `selectedCandidateKind`, `fallbackTemplateKind`, `replyTemplateFingerprint`, `priorContextUsed`, `followupResolvedFromHistory`, `knowledgeCandidateUsed`, `readinessDecision`, `userMessageMasked`, `assistantReplyMasked`, `priorContextSummaryMasked`, `textPolicy`

Notes:
- `conversation_review_snapshots` stores masked and length-capped review text only.
- plaintext user/assistant transcript is not durably stored in this collection.
- review snapshots are add-only and retention-bound for patrol use.
- transcript snapshot skip/failure classification is stored in `llm_action_logs`, not as a new raw transcript store.

### Quality Patrol review units (derived, read-only)
Purpose: build review-ready units for downstream conversation evaluation without persisting another transcript copy.

Typical fields:
- `reviewUnitId`, `traceId`, `lineUserKey`, `sourceWindow`
- `slice`, `sliceReason`, `sliceSignalsUsed`
- `userMessage`, `assistantReply`, `priorContextSummary`
- `telemetrySignals`, `observationBlockers`, `evidenceRefs`, `sourceCollections`

Notes:
- sources: `conversation_review_snapshots`, `llm_action_logs`, `faq_answer_logs`, `trace_bundle`
- review units are not persisted; they are derived read-only outputs for downstream evaluator/detection PRs.
- transcript coverage diagnostics are derived from `llm_action_logs` outcome/input telemetry and stay separate from transcript availability rates.
- `faq_answer_logs` are auxiliary evidence and do not create standalone review units without a snapshot/action anchor.
- extractor responses may include add-only `joinDiagnostics` such as `faqOnlyRowsSkipped`, `traceHydrationLimitedCount`, and `reviewUnitAnchorKindCounts`.

### Quality Patrol evaluator outputs (derived, read-only)
Purpose: deterministic conversation quality assessment over review units without writing issue registry or backlog records.

Typical fields:
- `reviewUnitId`, `slice`, `status`, `observationBlockers`
- `signals.naturalness`, `signals.continuity`, `signals.specificity`
- `signals.proceduralUtility`, `signals.knowledgeUse`, `signals.fallbackRepetition`
- `issueCandidates`, `supportingEvidence`, `provenance`, `sourceCollections`

Notes:
- evaluator outputs are not persisted in PR-3.
- issue candidates remain read-only hints until a later detection/registry PR consumes them.

### Quality Patrol KPI envelopes (derived, read-only)
Purpose: aggregate evaluator outputs into signal, availability, blocker, and issue-candidate KPIs for downstream detection/query layers.

Typical fields:
- `summary.overallStatus`, `summary.reviewUnitCount`, `summary.sliceCounts`
- `metrics.*` with `value`, `sampleCount`, `missingCount`, `falseCount`, `blockedCount`, `unavailableCount`, `status`
- `issueCandidateMetrics.*`
- `decayAwareReadiness.recentWindowStatus`, `historicalBacklogStatus`, `overallReadinessStatus`
- `decayAwareReadiness.recentWindow`, `fullWindow`, `previousFullWindow`, `deltaFromPreviousFullWindow`
- `decayAwareReadiness.historicalDebt`, `currentRuntimeHealth`
- `decayAwareOpsGate.decision`, `decisionReasonCode`, `operatorAction`, `prDEligible`, `prDStatus`, `prDReasonCode`
- `observationBlockers`, `provenance`, `sourceCollections`

Notes:
- KPI envelopes are not persisted in PR-4.
- KPI builder aggregates evaluator results and review units only; registry writes start in later PRs.

### Quality Patrol detection results (derived, optional persistence)
Purpose: convert KPI envelopes into deterministic issue candidates and minimal backlog candidates for downstream operator and planning layers.

Typical fields:
- `summary.issueCount`, `summary.blockedCount`, `summary.openCount`, `summary.byType`, `summary.bySlice`
- `issueCandidates[]` with `issueType`, `metricKey`, `slice`, `severity`, `status`, `confidence`
- `backlogCandidates[]` with `title`, `priority`, `objective`

Notes:
- detection results are not stored by default in PR-5.
- `detectAndUpsertQualityIssues` may reuse existing `quality_issue_registry` and `quality_improvement_backlog` foundations only when explicit persistence is requested.

### Quality Patrol root cause reports (derived, read-only)
Purpose: map deterministic detection issues into ranked cause candidates with supporting evidence and evidence gaps for future planning layers.

Typical fields:
- `rootCauseReports[]` with `issueKey`, `issueType`, `slice`, `analysisStatus`, `rootCauseSummary`
- `causeCandidates[]` with `causeType`, `rank`, `confidence`, `supportingSignals`, `supportingEvidence`, `evidenceGaps`
- `observationBlockers`, `provenance`, `sourceCollections`

Notes:
- root cause reports are not persisted in PR-6.
- analyzer is deterministic only and does not update issue registry or backlog state.

### Quality Patrol improvement plans (derived, read-only)
Purpose: convert ranked root-cause reports into deterministic proposal bundles for future query and scheduler layers.

Typical fields:
- `planVersion`, `generatedAt`, `planningStatus`, `summary`
- `recommendedPr[]` with `proposalKey`, `proposalType`, `priority`, `title`, `objective`
- `whyNow`, `whyNotOthers`, `rootCauseRefs`, `targetFiles`, `expectedImpact`
- `riskLevel`, `rollbackPlan`, `preconditions`, `blockedBy`, `confidence`
- `observationBlockers`, `provenance`, `sourceCollections`

Notes:
- improvement plans are not persisted in PR-7.
- planner is deterministic only and returns suggestions; it does not write registry/backlog state or change runtime behavior.
- observation-gap-led plans stay in observation-only families until evidence quality improves.

### Quality Patrol query responses (derived, read-only)
Purpose: expose read-only operator/human query views over the quality patrol foundations without changing the route contract when scheduler artifacts are added.

Typical fields:
- `queryVersion`, `generatedAt`, `audience`
- `summary.overallStatus`, `summary.topFindings`, `summary.topPriorityCount`, `summary.observationBlockerCount`
- `issues[]`, `observationBlockers[]`, `evidence[]`, `traceRefs[]`, `recommendedPr[]`
- `observationStatus`, `provenance`, `sourceCollections`
- operator `observationBlockers[]` may also include add-only precision fields such as `code`, `category`, `evidenceSource`, `privacySensitivity`, and `detailVisibility`
- add-only `backlogSeparation.currentRuntime`, `backlogSeparation.historicalDebt`, and `backlogSeparation.backlogSeparationGate`
- human audience keeps the same top-level query keys but compresses:
  - `observationBlockers[]` to privacy-safe summaries without raw blocker codes
  - `rootCauseResult` / `planResult` to summary-only shells
  - `transcriptCoverage` / `decayAwareReadiness` / `decayAwareOpsGate` to compressed read-side summaries without internal taxonomy strings

Notes:
- query responses are not persisted in PR-8.
- route: `GET /api/admin/quality-patrol`
- query is read-only and uses the existing review-unit, evaluator, KPI, detection, root-cause, and planner foundations as inputs.
- operator audience may receive trace refs and denser evidence; human audience hides raw trace ids and compresses internal metadata.
- PR-9 admin UI consumes the same route in `pane-quality-patrol` with `mode` and `audience` selectors.
- route: `POST /api/admin/quality-patrol/desktop-approval/plan`
- route: `POST /api/admin/quality-patrol/desktop-approval/execute`
- the plan route returns `planHash` / `confirmToken` for the latest approval stage and does not mutate runtime state.
- the execute route is `managedFlowGuard`-protected, local-only, and advances one approval artifact stage per call.

### Quality Patrol job artifacts (derived, filesystem, read-only by default)
Purpose: allow manual or scheduled patrol runs to materialize stable JSON artifacts without changing runtime, Firestore collection meaning, or query route shape.

Typical files:
- `/tmp/quality_patrol_latest.json`
- `/tmp/quality_patrol_metrics.json`
- `/tmp/quality_patrol_detection.json`
- `/tmp/quality_patrol_planning.json`
- `/tmp/quality_patrol_replay_result.json`
- `/tmp/quality_patrol_postmerge_verify.json`
- `/tmp/quality_patrol_cycle_replay.json`
- `/tmp/quality_patrol_cycle_metrics.json`
- `/tmp/quality_patrol_cycle_latest.json`
- `/tmp/quality_patrol_cycle_operator.json`
- `/tmp/quality_patrol_cycle_human.json`
- `/tmp/quality_patrol_cycle_verify.json`

Typical fields:
- `summary`, `issues[]`, `observationBlockers[]`, `evidence[]`, `traceRefs[]`, `recommendedPr[]`
- `mode`, `audience`, `generatedAt`
- `planningStatus`, `analysisStatus`, `observationStatus`
- `decayAwareReadiness`
- `decayAwareOpsGate`
- `backlogSeparation`
- `runtimeFetchStatus`, `writeStatus`, `sourceWindow`, `sourceCollections`
- human audience preserves the same top-level artifact keys but removes direct exposure of internal taxonomy / reason-code strings from:
  - `observationBlockers[]`
  - `transcriptCoverage`
  - `decayAwareReadiness`
  - `decayAwareOpsGate`
  - `rootCauseResult`
  - `planResult`

Notes:
- PR-10 jobs are CLI first and read-only by default.
- PR-11 adds `tools/quality_patrol/run_quality_patrol_cycle.js` and `.github/workflows/quality-patrol.yml` for hourly observation automation.
- `--write-issues` and `--write-backlog` are explicit opt-in flags.
- no new Firestore collection is introduced for these artifacts in PR-10.
- operator/human query evidence may also expose `quality_patrol_decay_ops_gate` summaries; these remain derived and are not persisted.
- post-merge replay verification is repo-local:
  - replay harness: `tools/quality_patrol/replay_same_traffic_set.js`
  - verify harness: `tools/quality_patrol/verify_postmerge_runtime_window.js`
- replay harness writes through the normal webhook -> action log -> snapshot path and does not create a separate raw transcript store.

### LINE Desktop Patrol scaffold artifacts (local, filesystem, add-only)
Purpose: reserve the local-only contract for future macOS LINE Desktop observation, read-only eval, and local proposal review without changing the existing webhook/runtime collections.

Typical files:
- `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
- `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`
- `artifacts/line_desktop_patrol/runs/<run_id>/result.json`
- `artifacts/line_desktop_patrol/runs/<run_id>/before.png`
- `artifacts/line_desktop_patrol/runs/<run_id>/after.png`
- `artifacts/line_desktop_patrol/runs/<run_id>/before.ax.json`
- `artifacts/line_desktop_patrol/runs/<run_id>/after.ax.json`
- `artifacts/line_desktop_patrol/runs/<run_id>/after.visible.json`
- `artifacts/line_desktop_patrol/proposals/queue.jsonl`
- `artifacts/line_desktop_patrol/proposals/packets/<proposal_id>.codex.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_draft.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_task.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_task.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_diff_draft.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_diff_draft.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.prompt.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.patch`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.prompt.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.prompt.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.prompt.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.prompt.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.json`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.md`
- `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.prompt.md`
- `artifacts/line_desktop_patrol/acceptance/latest.json`
- `artifacts/line_desktop_patrol/runs/<run_id>/proposal_linkage.json`
- `artifacts/line_desktop_patrol/runtime/state.json`
- `artifacts/line_desktop_patrol/runtime/execute.lock.json`
- `tmp/line_desktop_patrol_latest.json`

Typical fields:
- trace:
  - `run_id`, `scenario_id`, `session_id`
  - `started_at`, `finished_at`
  - `git_sha`, `app_version`, `target_id`
  - `sent_text`, `visible_before`, `visible_after`
  - `screenshot_before`, `screenshot_after`
  - `ax_tree_before`, `ax_tree_after`
  - `model_config`, `retrieval_refs`, `evaluator_scores`
  - `failure_reason`, `proposal_id`
  - optional execute fields: `send_mode`, `send_attempted`, `target_validation`, `target_resolution`, `open_target`, `send_result`
  - optional execute fields: `pre_observation`, `post_observation`, `correlation_status`
  - optional execute fields: `reply_wait_window_ms`, `execute_guard_reason`
- policy:
  - `enabled`, `dry_run_default`, `allowed_targets`, `blocked_hours`
  - `max_runs_per_hour`, `failure_streak_threshold`, `ui_drift_threshold`
  - `require_target_confirmation`, `store_screenshots`, `store_ax_tree`
  - `proposal_mode`, `auto_apply_level`
- proposal queue:
  - `proposal_id`, `source_trace_ids`, `root_cause_category`
  - `proposed_change_scope`, `affected_files`, `expected_score_delta`
  - `risk_level`, `requires_human_review`
- promotion record:
  - `proposal_id`, `status`, `branch_name`, `base_ref`, `worktree_path`
  - `body_path`, `patch_draft_path`, `draft_pr_url`, `draft_pr_ref`, `risk_level`
- patch synthesis bundle:
  - `proposal_id`, `status`, `promotion_record_path`, `packet_path`
  - `patch_draft_path`, `patch_request_path`, `patch_request_markdown_path`
  - `validation_commands[]`, `candidate_edits[]`, `operator_instructions[]`
- code patch bundle:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_patch_bundle_path`, `code_patch_bundle_markdown_path`
  - `file_snapshots[]` with `file_path`, `workspace_file_path`, `exists`, `line_count`, `size_bytes`, `preview`, `preview_truncated`
  - `validation_commands[]`, `stop_conditions[]`, `operator_instructions[]`
- code edit task:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_edit_task_path`, `code_edit_task_markdown_path`
  - `edit_tasks[]` with `task_id`, `file_path`, `workspace_file_path`, `patch_shape`, `anchor_preview`, `edit_goal`
  - `edit_tasks[].apply_patch_hint` with bounded template lines
  - `validation_commands[]`, `review_checklist[]`, `stop_conditions[]`
- code diff draft:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_diff_draft_path`, `code_diff_draft_markdown_path`
  - `diff_tasks[]` with `task_id`, `file_path`, `workspace_file_path`, `patch_shape`, `anchor_preview`, `draft_summary`
  - `diff_tasks[].draft_patch_lines[]` with apply_patch-ready placeholder lines
  - `validation_commands[]`, `review_checklist[]`, `stop_conditions[]`
- code edit bundle:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_edit_bundle_path`, `code_edit_bundle_markdown_path`, `worker_prompt_path`
  - `task_packets[]` copied from the diff draft
  - `worker_prompt` with write set, expected outputs, validation commands, and stop conditions
  - `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code apply draft:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_apply_draft_path`, `code_apply_draft_markdown_path`, `patch_document_path`
  - `task_packets[]` copied from the code edit bundle
  - `apply_steps[]`, `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code apply task:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_apply_task_path`, `code_apply_task_markdown_path`, `worker_prompt_path`
  - `code_apply_draft_path`, `patch_document_path`, `task_packets[]`
  - `review_checklist[]`, `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code review packet:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_review_packet_path`, `code_review_packet_markdown_path`, `review_prompt_path`
  - `code_apply_task_path`, `patch_document_path`, `approval_checklist[]`
  - `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code apply evidence:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_apply_evidence_path`, `code_apply_evidence_markdown_path`, `evidence_prompt_path`
  - `code_review_packet_path`, `patch_document_path`, `evidence_requirements[]`
  - `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code apply signoff:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_apply_signoff_path`, `code_apply_signoff_markdown_path`, `signoff_prompt_path`
  - `code_apply_evidence_path`, `code_review_packet_path`, `patch_document_path`, `signoff_requirements[]`
  - `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- code apply record:
  - `proposal_id`, `status`, `worktree_path`, `branch_name`
  - `code_apply_record_path`, `code_apply_record_markdown_path`, `record_prompt_path`
  - `code_apply_signoff_path`, `code_apply_evidence_path`, `code_review_packet_path`, `patch_document_path`, `record_requirements[]`
  - `expected_outputs[]`, `validation_commands[]`, `stop_conditions[]`
- admin desktop summary promotion view:
  - `desktopPatrolSummary.promotion.latestProposalId`
  - `desktopPatrolSummary.promotion.latestArtifactKind`
  - `desktopPatrolSummary.promotion.latestArtifactStatus`
  - `desktopPatrolSummary.promotion.latestDraftPrRef`
  - `desktopPatrolSummary.promotion.updatedAt`
- admin desktop summary promotion review view:
  - `desktopPatrolSummary.promotionReview.latestProposalId`
  - `desktopPatrolSummary.promotionReview.reviewStatus`
  - `desktopPatrolSummary.promotionReview.latestDraftPrRef`
  - `desktopPatrolSummary.promotionReview.latestReviewArtifactKind`
  - `desktopPatrolSummary.promotionReview.latestReviewArtifactRef`
  - `desktopPatrolSummary.promotionReview.worktreeRef`
  - `desktopPatrolSummary.promotionReview.branchName`
  - `desktopPatrolSummary.promotionReview.patchDraftRef`
  - `desktopPatrolSummary.promotionReview.codeEditTaskRef`
  - `desktopPatrolSummary.promotionReview.codeApplyDraftRef`
  - `desktopPatrolSummary.promotionReview.codeReviewPacketRef`
  - `desktopPatrolSummary.promotionReview.updatedAt`
- admin desktop summary promotion approval view:
  - `desktopPatrolSummary.promotionApproval.latestProposalId`
  - `desktopPatrolSummary.promotionApproval.approvalStage`
  - `desktopPatrolSummary.promotionApproval.approvalStatus`
  - `desktopPatrolSummary.promotionApproval.latestDraftPrRef`
  - `desktopPatrolSummary.promotionApproval.branchName`
  - `desktopPatrolSummary.promotionApproval.worktreeRef`
  - `desktopPatrolSummary.promotionApproval.latestArtifactRef`
  - `desktopPatrolSummary.promotionApproval.latestPromptRef`
  - `desktopPatrolSummary.promotionApproval.patchRequestRef`
  - `desktopPatrolSummary.promotionApproval.codeApplyTaskRef`
  - `desktopPatrolSummary.promotionApproval.codeApplySignoffRef`
  - `desktopPatrolSummary.promotionApproval.codeApplyRecordRef`
  - `desktopPatrolSummary.promotionApproval.codeApplyEvidenceRef`
  - `desktopPatrolSummary.promotionApproval.codeApplyEvidencePromptRef`
  - `desktopPatrolSummary.promotionApproval.validationCommands[]`
  - `desktopPatrolSummary.promotionApproval.validationCommandCount`
  - `desktopPatrolSummary.promotionApproval.candidateEdits[]`
  - `desktopPatrolSummary.promotionApproval.candidateEditCount`
  - `desktopPatrolSummary.promotionApproval.operatorInstructions[]`
  - `desktopPatrolSummary.promotionApproval.operatorInstructionCount`
  - `desktopPatrolSummary.promotionApproval.evidenceRequirements[]`
  - `desktopPatrolSummary.promotionApproval.evidenceRequirementCount`
  - `desktopPatrolSummary.promotionApproval.expectedOutputs[]`
  - `desktopPatrolSummary.promotionApproval.expectedOutputCount`
  - `desktopPatrolSummary.promotionApproval.stopConditions[]`
  - `desktopPatrolSummary.promotionApproval.stopConditionCount`
  - `desktopPatrolSummary.promotionApproval.nextCommand`
  - `desktopPatrolSummary.promotionApproval.remainingCommands[]`
  - `desktopPatrolSummary.promotionApproval.remainingCommandCount`
  - `desktopPatrolSummary.promotionApproval.nextAction`
  - `desktopPatrolSummary.promotionApproval.updatedAt`
  - plan response only: `planHash`
  - plan response only: `confirmToken`
- admin desktop summary promotion batch view:
  - `desktopPatrolSummary.promotionBatch.batchRunId`
  - `desktopPatrolSummary.promotionBatch.stage`
  - `desktopPatrolSummary.promotionBatch.completionStatus`
  - `desktopPatrolSummary.promotionBatch.queuedProposalCount`
  - `desktopPatrolSummary.promotionBatch.patchDraftReadyCount`
  - `desktopPatrolSummary.promotionBatch.blockedCaseIds[]`
  - `desktopPatrolSummary.promotionBatch.statusCounts{}`
  - `desktopPatrolSummary.promotionBatch.nextAction`
  - `desktopPatrolSummary.promotionBatch.updatedAt`
- loop state:
  - `updated_at`, `failure_streak`, `last_run_id`, `last_failure_reason`
  - `recent_runs[]`, `last_decision`, `recent_runs[].send_attempted`, `last_decision.send_attempted`
- Codex packet:
  - `contract_version`, `proposal_id`, `queue_entry`
  - `trace_ref`, `evaluation_ref`, `proposal`
  - `operator_summary`, `codex_task_brief`

Notes:
- PR6 guarded loop uses `artifacts/line_desktop_patrol/runtime/state.json` only for local rate limiting / stop-state continuity.
- guard decisions still emit per-run trace artifacts so operator evidence stays append-only even when the loop skips execution.
- PR7 allows `screenshot_after` to point at `artifacts/line_desktop_patrol/runs/<run_id>/after.png` when a local override enables `store_screenshots=true`.
- PR9 allows `ax_tree_after` to point at `artifacts/line_desktop_patrol/runs/<run_id>/after.ax.json` when a local override enables `store_ax_tree=true`.
- PR11 allows `visible_after` plus `observation_artifacts.read_visible_messages.output_path` to point at `artifacts/line_desktop_patrol/runs/<run_id>/after.visible.json` when a local override enables `store_ax_tree=true`.
- PR13 adds execute trace fields for send/validation/correlation while preserving the original required trace schema.
- PR13 execute traces can emit `open_target_mismatch_stop` alongside `open_target_ready`; preflight failures remain diagnostic and do not imply a sent message.
- PR15 adds promotion metadata under `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`.
- PR19 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_draft.md` so proposal promotion can stop at a reviewable patch intent before any code diff exists.
- PR20 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.json` and `.patch_request.md` so operators can hand a proposal to a human patch workflow without widening runtime authority.
- PR21 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.json` and `.code_patch_bundle.md` so the human patch workflow can snapshot candidate files before writing code.
- PR22 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_task.json` and `.code_edit_task.md` so the human patch workflow can turn snapshots into per-file edit tasks before writing code.
- PR23 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_diff_draft.json` and `.code_diff_draft.md` so the human patch workflow can turn edit tasks into apply_patch-ready draft stubs before writing code.
- PR24 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.json`, `.code_edit_bundle.md`, and `.code_edit_bundle.prompt.md` so the human patch workflow can hand the diff draft to an actual code-edit session without widening runtime authority.
- PR25 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.json`, `.code_apply_draft.md`, and `.code_apply_draft.patch` so the human patch workflow can review the final apply_patch payload before any code is touched.
- PR26 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.json`, `.code_apply_task.md`, and `.code_apply_task.prompt.md` so the human patch workflow can hand the reviewed apply draft to the final apply session without widening runtime authority.
- PR27 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.json`, `.code_review_packet.md`, and `.code_review_packet.prompt.md` so the human patch workflow can capture the final approval checklist before any reviewed apply step is carried out.
- PR28 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.json`, `.code_apply_evidence.md`, and `.code_apply_evidence.prompt.md` so the human patch workflow can capture the final apply evidence after the reviewed apply step.
- PR29 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.json`, `.code_apply_signoff.md`, and `.code_apply_signoff.prompt.md` so the final approver can record the go/no-go signoff after the evidence pass without auto-applying code.
- PR30 adds `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.json`, `.code_apply_record.md`, and `.code_apply_record.prompt.md` so the operator can record the final post-apply and post-merge closure without auto-applying code.
- PR31 adds read-only `desktopPatrolSummary.promotion.*` fields so Admin can surface the latest promotion/apply-record artifact kind, status, draft PR ref, and timestamp without mutating the local queue.
- PR16 adds `artifacts/line_desktop_patrol/runtime/execute.lock.json` for overlap protection in scheduled execute mode.
- PR18 adds `artifacts/line_desktop_patrol/acceptance/latest.json` for KPI + manual soak completion gating.
- PR18 acceptance summary keeps `attemptedSendCount` on `send_attempted=true` runs only and adds diagnostics such as `openTargetRunCount` and `openTargetMismatchCount` so open-target preflight can be observed without inflating send KPIs.
- current patrol emits local trace/result artifacts and a latest summary file.
- desktop UI loops may emit add-only header OCR evidence and transcript deltas inside `result.json`; screenshot files are emitted only when local policy enables `store_screenshots`.
- PR2 adds local dry-run trace emission through `member_line_patrol.dry_run_harness`.
- raw desktop evidence remains local-only and is not written to Firestore in PR1.
- PR2 keeps `screenshot_*` and `ax_tree_*` null in the default dry-run harness because capture/read steps are still deferred.
- PR3 desktop eval artifacts are derived read-only outputs that reuse the existing `qualityPatrol` pipeline and do not add Firestore collections.
- PR4 adds a local append-only proposal queue and per-proposal Codex packets; both remain filesystem-only and human-review gated.
- PR17 retention only targets stale raw screenshot / AX / visible artifacts and intentionally preserves trace / eval / queue artifacts.
- global stop continues to be the existing kill switch; local patrol enablement stays in the local policy file.

### `decision_logs/{id}` / `decision_timeline/{id}` / `ops_states/{lineUserId}`
Purpose: operations decisions, readiness, and state tracking.

Compatibility note:
- `ops_states` が canonical。
- `ops_state` は read fallback 互換としてのみ維持し、運用書き込み先には使わない。

### `notification_templates/{id}` / `templates_v/{id}`
Purpose: Ops 通知 template と versioned content。`notification_templates.exceptionPlaybook` が存在する template は Canonical Core `exception_playbook` sidecar の runtime authority として扱う。

Typical fields for `notification_templates/{id}`:
- `key`, `status`, `notificationCategory`
- `title`, `body`, `text`, `ctaText`, `linkRegistryId`
- `exceptionPlaybook`
  - `exceptionCode`, `domain`, `topic`, `countryCode`, `scopeKey`
  - `audienceScope[]`, `householdScope[]`, `visaScope[]`
  - `severity`, `symptomPatterns[]`, `detectionExpr`
  - `summaryMd`, `bodyMd`, `fallbackSteps[]`, `escalationContacts`
  - `authorityFloor`, `reviewerStatus`, `linkedTaskTemplates[]`, `requiredEvidence[]`
- `recordEnvelope`
- `createdAt`, `updatedAt`

Typical fields for `templates_v/{id}`:
- `templateKey`, `version`, `status`
- `content`（versioned template body）
- `createdAt`, `updatedAt`

Notes:
- `templates_v` は versioned content store のまま維持し、この段階では `exception_playbook` authority に使わない。
- `notification_templates` の draft/active/inactive 遷移が `exception_playbook.activeFlag/staleFlag` の入力になる。

### `events/{id}` / `notifications/{id}` / `checklists/*` / `user_checklists/*`
Purpose: product events, notification metadata, and checklist progress.

Typical fields for `events/{id}` (vendor shadow add-only):
- `lineUserId`, `type`, `ref`
- `traceId`, `requestId`
- `shadow.currentOrderLinkIds[]`
- `shadow.rankedLinkIds[]`
- `shadow.items[]` (`linkId`, `relevanceScore`, `scoreBreakdown`, `explanationCodes`)
- `createdAt`

Typical fields for `notifications/{id}` (add-only excerpts):
- `title`, `body`, `ctaText`, `linkRegistryId`
- `scenarioKey`, `stepKey`, `notificationCategory`
- `target` (`limit` required in send path)
- `status` (`draft`/`active`/`sent`)
- `notificationType` (`GENERAL`/`ANNOUNCEMENT`/`VENDOR`/`AB`/`STEP`)
- `notificationMeta` (type-specific UI metadata; optional)

### `notification_deliveries/{id}`
Purpose: delivery idempotency / reaction tracking / cap evaluation source-of-truth.

Typical fields:
- `notificationId`, `lineUserId`
- `state` (`reserved`/`failed`/`delivered`/`sealed`/`delivery_persist_failed_after_push`)
- `delivered` (boolean)
- `sentAt` (timestamp|string|null)
- `deliveredAt` (timestamp|string|null, cap evaluation primary time)
- `readAt`, `clickAt`, `lastError`, `lastErrorAt`
- `deliveryPersistError`, `deliveryPersistErrorAt`（push成功後の保存失敗を再送誘発なしで記録）
- `sealed`, `sealedAt`, `sealedBy`, `sealedReason`
- `deliveredAtBackfilledAt`, `deliveredAtBackfilledBy` (manual backfill evidence)

### `step_rules/{ruleId}`
Purpose: Step=Task 決定のルール定義（Task Engine v1）。

Typical fields:
- `scenarioKey`, `stepKey`
- `trigger.eventKey`, `trigger.source`
- `leadTime.kind`, `leadTime.days`
- `dependsOn[]`
- `constraints.quietHours`, `constraints.maxActions`, `constraints.planLimit`
- `priority`, `enabled`, `validFrom`, `validUntil`, `riskLevel`
- `nudgeTemplate`（任意）
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

### `tasks/{taskId}`
Purpose: Task Engine のユーザー向け read model（Task API の応答母体）。

Typical fields:
- `taskId` (`lineUserId__ruleId`)
- `userId`, `lineUserId`
- `scenarioKey`, `stepKey`, `ruleId`
- `status` (`todo|doing|done|blocked|snoozed`)
- `dueAt`, `nextNudgeAt`, `blockedReason`
- `sourceEvent`
- `engineVersion`, `decisionHash`, `checkedAt`
- `nudgeCount`, `lastNotifiedAt`
- `createdAt`, `updatedAt`

### `task_contents/{taskKey}`
Purpose: LINE内完結の Task詳細表示（Flex + Manual/Failure本文）を保持する add-only 編集モデル。

Typical fields:
- `taskKey`（doc id と同一）
- `title`
- `timeMin`, `timeMax`
- `checklistItems[]`
  - `id`, `text`, `order`, `enabled`
- `manualText`（postbackでLINE内表示）
- `failureText`（postbackでLINE内表示）
- `videoLinkId`（`link_registry`参照）
- `actionLinkId`（`link_registry`参照）
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

### `journey_templates/{templateId}`
Purpose: Journey 3フェーズテンプレート（template起点 step_rules 生成元）。

Typical fields:
- `templateId`, `version`, `country`, `scenarioKey`
- `enabled`, `validFrom`, `validUntil`
- `phases[]`（`phaseKey`, `steps[]`）
- `steps[].stepKey`, `steps[].title`
- `steps[].trigger`, `steps[].leadTime`, `steps[].dependsOn`, `steps[].constraints`
- `steps[].priority`, `steps[].riskLevel`, `steps[].enabled`, `steps[].nudgeTemplate`
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

### `task_events/{eventId}`
Purpose: Task状態変化のappend-only監査ログ（dry-run非書込）。

Typical fields:
- `taskId`, `userId`, `lineUserId`, `ruleId`
- `scenarioKey`, `stepKey`
- `decision`（`created|updated|status_changed|blocked`）
- `beforeStatus`, `afterStatus`
- `beforeBlockedReason`, `afterBlockedReason`
- `checkedAt`, `traceId`, `requestId`, `actor`, `source`
- `explainKeys[]`
- `createdAt`, `updatedAt`

### `step_rule_change_logs/{id}`
Purpose: Step Rules の変更履歴（append-only）。

Typical fields:
- `action` (`upsert_rule|set_enabled`)
- `ruleId`
- `actor`
- `traceId`, `requestId`
- `planHash`
- `rule`（適用後スナップショット）
- `summary`
- `createdAt`

### `send_retry_queue/{id}`
Purpose: 送信失敗の再送/解決キュー（phase73運用導線）。

Typical fields:
- `status` (`PENDING`/`DONE`/`GAVE_UP`)
- `lineUserId`
- `templateKey`
- `payloadSnapshot`（再送時に使う最小ペイロード）
- `lastError`
- `giveUpReason`（add-only）
- `resolvedBy`（add-only）
- `resolvedAt`（add-only）
- `createdAt`, `updatedAt`

### `link_registry/{id}`（教育 add-only field）
Purpose: 通知/City Packが参照するリンク辞書。教育用途では公立学校公式リンクを管理する。

Typical fields (education add-only):
- `domainClass` (`gov`/`k12_district`/`school_public`/`unknown`)
- `schoolType` (`public`/`private`/`unknown`)
- `eduScope` (`calendar`/`district_info`/`enrollment`/`closure_alert`)
- `regionKey`
- `tags[]`（例: `education`,`calendar`,`public`）

### `city_packs/{id}`
Purpose: City Pack の宣言型配信ロジック束。

Typical fields:
- `name`
- `status` (`draft`/`active`/`retired`)
- `sourceRefs[]`
- `validUntil`
- `allowedIntents` (固定: `CITY_PACK`)
- `rules[]`
- `targetingRules[]`（Rule Pack）
- `slots[]`（Slot-based Pack）
- `slotContents`（固定8スロット体験マップ）
- `slotSchemaVersion`（例: `v1_fixed_8_slots`）
- `basePackId`（1段のみ継承）
- `overrides`（継承上書き）
- `packClass` (`regional`/`nationwide`)
- `language`（既定 `ja`）
- `nationwidePolicy`（`packClass=nationwide` のとき `federal_only`）
- Responsibility boundary（add-only）:
- `packClass=regional`: 地域固有手続き（city/state/municipality）を担当
- `packClass=nationwide` + `nationwidePolicy=federal_only`: 連邦レベル共通手続きのみを担当

### `city_pack_requests/{requestId}`
Purpose: City Pack 生成リクエストの状態機械（LINE申告→草案→承認→有効化）。

Typical fields:
- `status` (`queued`/`collecting`/`drafted`/`needs_review`/`approved`/`active`/`rejected`/`failed`)
- `lineUserId`
- `regionCity`, `regionState`, `regionKey`
- `requestClass` (`regional`/`nationwide`)
- `requestedLanguage`（既定 `ja`）
- `requestedAt`
- `lastJobRunId`
- `traceId`
- `draftCityPackIds[]`
- `draftTemplateIds[]`
- `draftSourceRefIds[]`
- `draftLinkRegistryIds[]`
- `experienceStage`
- `lastReviewAt`
- `error`
- `errorCode`（fatal fail時）
- `errorMessage`（fatal fail時）
- `failedAt`（fatal fail時）

Assignment-triggered recompute audit (add-only):
- `audit_logs.action=journey.assignment_recompute.enqueued`
- `audit_logs.action=journey.assignment_recompute.completed`
- `audit_logs.action=journey.assignment_recompute.failed`
- `payloadSummary.assignmentDate/departureDate/stage/error`

### `city_pack_feedback/{id}`
Purpose: City Packの誤り報告（LINE→admin review）。

Typical fields:
- `status` (`queued`/`reviewed`/`rejected`/`proposed`/`new`/`triaged`/`resolved`)
- `lineUserId`
- `regionCity`, `regionState`, `regionKey`
- `packClass` (`regional`/`nationwide`)
- `language`（既定 `ja`）
- `feedbackText`
- `message`
- `slotKey`
- `resolution`
- `resolvedAt`
- `traceId`
- `requestId`

### `source_refs/{id}`
Purpose: City Pack が参照する情報源の監査状態管理。

Typical fields:
- `url`
- `status` (`active`/`needs_review`/`dead`/`blocked`/`retired`)
- `validFrom`, `validUntil`
- `lastResult`, `lastCheckAt`
- `contentHash`
- `riskLevel`
- `sourceType` (`official`/`semi_official`/`community`/`other`)
- `requiredLevel` (`required`/`optional`)
- `authorityLevel` (`federal`/`state`/`local`/`other`)
- `confidenceScore`（0..100）
- `lastAuditStage` (`light`/`heavy`)
- `domainClass` (`gov`/`k12_district`/`school_public`/`unknown`)
- `schoolType` (`public`/`private`/`unknown`)
- `eduScope` (`calendar`/`district_info`/`enrollment`/`closure_alert`)
- `regionKey`
- `evidenceLatestId`
- `usedByCityPackIds[]`

### `municipality_schools/{id}`
Purpose: 自治体単位の公立学校インポート結果（NCES CCD など）。

Typical fields:
- `regionKey`
- `name`
- `type`（固定: `public`）
- `district`
- `sourceLinkRegistryId`
- `sourceUrl`
- `lastFetchedAt`
- `traceId`
- `createdAt`, `updatedAt`

### `school_calendar_links/{id}`
Purpose: 公立学校カレンダーの参照リンク管理（本文非保持）。

Typical fields:
- `regionKey`
- `linkRegistryId`
- `sourceRefId`
- `schoolYear`
- `status` (`active`/`archived`)
- `validUntil`
- `traceId`
- `createdAt`, `updatedAt`

### `source_evidence/{id}`
Purpose: 情報源監査の証跡（append-only）。

Typical fields:
- `sourceRefId`
- `checkedAt`
- `result`
- `statusCode`
- `finalUrl`
- `contentHash`
- `screenshotPaths[]`
- `diffSummary`
- `traceId`
- `llm_used`, `model`, `promptVersion`

### `source_audit_runs/{runId}`
Purpose: 監査ジョブ実行の run 単位サマリ（冪等管理）。

Typical fields:
- `runId`, `mode`
- `stage` (`light`/`heavy`)
- `startedAt`, `endedAt`
- `processed`, `succeeded`, `failed`
- `failureTop3[]`
- `confidenceSummary` (`average`/`min`/`max`)
- `traceId`
- `targetSourceRefIds[]`

### `quality_issue_registry/{issueId}`
Purpose: Quality Patrol の検知 issue を重複抑制つきで保持する正規 registry。

Typical fields:
- `issueId`, `issueFingerprint`
- `threadId`
- `layer`, `category`, `slice`
- `severity`, `status`, `provenance`, `observationBlocker`, `confidence`
- `supportingEvidence[]`, `traceRefs[]`, `sourceCollections[]`, `relatedMetrics[]`
- `firstSeenAt`, `lastSeenAt`, `occurrenceCount`
- `latestSummary`
- `rootCauseHint[]`

Notes:
- fingerprint 単位で同一 issue を集約する。
- raw transcript は保存しない。

### `quality_improvement_backlog/{backlogId}`
Purpose: issue に紐づく改善候補 PR を保持する backlog。

Typical fields:
- `backlogId`
- `status`, `priority`
- `issueIds[]`
- `proposedPrName`, `objective`, `whyNow`
- `targetFiles[]`
- `expectedKpiMovement[]`
- `risk`
- `rollbackPlan`
- `dependency[]`
- `owner`
- `provenance`

### `city_pack_metrics_daily/{id}`
Purpose: City Pack効果測定（pack/slot/sourceRef単位の日次集計）。

Typical fields:
- `dateKey` (`YYYY-MM-DD`)
- `cityPackId`
- `slotId`
- `sourceRefId`
- `sentCount`, `deliveredCount`, `clickCount`, `readCount`, `failedCount`
- `ctr`
- `traceId`
- `lastComputedAt`, `updatedAt`

### `city_pack_template_library/{id}`
Purpose: City Pack import/exportで再利用するテンプレライブラリ。

Typical fields:
- `status` (`draft`/`active`/`retired`)
- `name`
- `schemaVersion`
- `template`（`city_pack_template_v1` のJSON）
- `source` (`manual` など)
- `traceId`, `requestId`
- `createdAt`, `updatedAt`, `activatedAt`, `retiredAt`

### `emergency_providers/{providerKey}`
Purpose: Emergency provider の有効/無効と取得頻度を管理する。

Typical fields:
- `providerKey`（`nws_alerts` / `usgs_earthquakes` / `fema_ipaws` / `openfema_declarations` / `openfda_recalls` / `airnow_aqi`）
- `status` (`enabled`/`disabled`)
- `scheduleMinutes`
- `officialLinkRegistryId`
- `lastRunAt`, `lastSuccessAt`, `lastError`
- `lastPayloadHash`, `lastEtag`, `lastModified`
- `traceId`
- `createdAt`, `updatedAt`

### `emergency_snapshots/{snapshotId}`
Purpose: provider取得結果の証跡（raw/要約/ハッシュ）を保持する。

Typical fields:
- `providerKey`
- `fetchedAt`
- `statusCode`
- `etag`, `lastModified`
- `payloadHash`
- `payloadPath`（必要時）
- `payloadSummary`
- `rawPayload`（サイズ上限内）
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_events_normalized/{eventDocId}`
Purpose: provider差異を吸収した正規化イベントを保持する。

Typical fields:
- `providerKey`
- `eventKey`
- `regionKey`
- `severity` (`INFO`/`WARN`/`CRITICAL`)
- `category` (`weather`/`earthquake`/`alert`/`recall`/`air`)
- `headline`
- `startsAt`, `endsAt`
- `officialLinkRegistryId`
- `snapshotId`
- `eventHash`
- `isActive`, `resolvedAt`
- `rawMeta`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_diffs/{diffId}`
Purpose: normalized event の差分（new/update/resolve）を保存する。

Typical fields:
- `providerKey`
- `regionKey`
- `category`
- `diffType` (`new`/`update`/`resolve`)
- `severity`
- `changedKeys[]`
- `summaryDraft`
- `snapshotId`
- `eventKey`, `eventDocId`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `emergency_bulletins/{bulletinId}`
Purpose: 通知候補（draft→approved→sent/rejected）を管理する。

Typical fields:
- `status` (`draft`/`approved`/`sent`/`rejected`)
- `providerKey`
- `regionKey`
- `category`
- `severity`
- `headline`
- `linkRegistryId`
- `messageDraft`
- `evidenceRefs`（`snapshotId` / `diffId` / `eventDocId`）
- `approvedBy`, `approvedAt`
- `sentAt`
- `notificationIds[]`
- `sendResult`
- `traceId`
- `createdAt`, `updatedAt`

### `emergency_rules/{ruleId}`
Purpose: Emergencyの事前承認ルール（自動配信条件）を管理する。

Typical fields:
- `providerKey`
- `eventType`（例: `weather.new`）
- `severity` (`ANY`/`INFO`/`WARN`/`CRITICAL`)
- `region`（`regionKey` または `state/city`。`county/zip` はpreview fail-closed）
- `membersOnly`
- `role`（現在はpreview fail-closed）
- `autoSend`
- `enabled`
- `priority` (`emergency`/`standard`)
- `maxRecipients`
- `traceId`
- `createdBy`, `updatedBy`
- `createdAt`, `updatedAt`

### `emergency_unmapped_events/{id}`
Purpose: region解決できなかったイベントを監査隔離する。

Typical fields:
- `providerKey`
- `eventKey`
- `reason`
- `snapshotId`
- `rawMeta`
- `runId`, `traceId`
- `createdAt`, `updatedAt`

### `ops_read_model_snapshots/{snapshotType__snapshotKey}`
Purpose: Ops KPI/summary の snapshot read-model（full scanの常用回避）。

Typical fields:
- `snapshotType`（`dashboard_kpi` / `user_operational_summary` / `user_state_summary`）
- `snapshotKey`（`1|3|6|12` や `latest` / `lineUserId`）
- `asOf`
- `freshnessMinutes`
- `sourceTraceId`
- `data`
- `createdAt`, `updatedAt`

### Planned Add-only (City Pack extensions 1-12, inactive until phase enable)
Purpose: 実装フェーズ分割時の互換契約を固定するための予定スキーマ。実装完了までは必須扱いにしない。

#### Planned fields in `city_packs/{id}`
- `targetingRules[]`: Rule Pack（targeting宣言）
- `slots[]`: Slot-based Pack定義
- `basePackId`: 継承元（1段のみ）
- `overrides`: 継承上書き

#### Planned fields in `source_refs/{id}`
- `sourceType`: 情報源種別
- `requiredLevel`: `required|optional`
- `authorityLevel`: `federal|state|local|other`
- `confidenceScore`: 信頼度スコア（0..100）
- `lastAuditStage`: `light|heavy`

#### Planned collections
- `city_pack_feedback/{id}`: ユーザー誤り報告導線
- `city_pack_bulletins/{id}`: Change Bulletin（draft/approved/sent）
- `city_pack_update_proposals/{id}`: 更新提案（適用は人間）
- `city_pack_metrics_daily/{id}`: pack/slot/sourceRef単位の集計
- `city_pack_template_library/{id}`: import/export用テンプレライブラリ

#### Planned fields in `city_pack_bulletins/{id}`
- `status`: `draft|approved|sent|rejected`
- `cityPackId` (required)
- `notificationId` (required)
- `summary` (required)
- `traceId` (required)
- `requestId` (optional)
- `approvedAt` / `sentAt`
- `deliveredCount`
- `llm_used` / `model` / `promptVersion` (optional)

#### Planned fields in `city_pack_update_proposals/{id}`
- `status`: `draft|approved|rejected|applied`
- `cityPackId` (required)
- `summary` (required)
- `proposalPatch` (allowlist apply)
- `traceId` (required)
- `requestId` (optional)
- `approvedAt` / `appliedAt`
- `llm_used` / `model` / `promptVersion` (optional)

## Secrets (Secret Manager)
Purpose: store secrets used by the system and CI deploy workflows.

Examples (stg):
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `ADMIN_OS_TOKEN`
- `TRACK_TOKEN_SECRET`
- `REDAC_MEMBERSHIP_ID_HMAC_SECRET`

## Logs
### Cloud Logging
Purpose: operational logs for debugging and incident response.

Notes:
- Logs should not include plaintext secrets or full membership ids.

## Data Access & Authorization
- Cloud Run IAM controls who can invoke private services.
- App-layer admin token (`ADMIN_OS_TOKEN`) additionally protects `/admin/*` and `/api/admin/*`.
- Public services (`member-webhook`, `member-track`) accept only their service-mode endpoints.

## Retention & Deletion
- The codebase does not implement automatic TTL deletion for Firestore collections.
- Retention is therefore effectively indefinite unless GCP-level retention policies are configured separately.

### Governance Cadence (recommended)
- Weekly:
  - check `audit_logs` / `notification_deliveries` growth trend
  - verify no plaintext secrets or full membership ids appear in sampled logs
- Monthly:
  - review retention settings for Firestore / Logging / Secret Manager
  - verify deletion/archival run evidence exists
- On incident/request:
  - run scoped deletion procedure and capture approval + execution evidence

### Operational Responsibility Split
- Application responsibility:
  - avoid storing plaintext secrets and full Redac membership ids
  - append audit logs with traceId/requestId for sensitive operations
  - provide manual recovery and administrative controls via `/api/admin/*`
- Infrastructure responsibility:
  - define and enforce retention/backup/deletion policies in GCP (Firestore/Logging/Secret Manager)
  - maintain IAM least-privilege and service account boundaries between environments
  - maintain WIF/OIDC trust policy for CI deploy identities
- Compliance/legal responsibility:
  - approve retention/deletion policy changes before rollout
  - keep policy decision records and approval dates

### Minimum Deletion Runbook Inputs (for legal/ops review)
- Which collection(s) or log sink(s) are in scope
- Reason for deletion (request/incident/policy)
- Approval record (who approved, when)
- Execution evidence (traceId, command/run URL, resulting counts)

### Minimum Deletion Evidence Outputs (fixed)
- ticket_or_request_id
- approver
- approved_at (UTC)
- executed_by
- executed_at (UTC)
- scope_summary (collections/sinks)
- before_count / after_count
- verification_command_and_result
- rollback_or_restore_plan

## Phase662 Add-only Collections

### journey_graph_change_logs
Purpose: Journey Graph Catalog の plan/set 設定履歴を監査保存する。  
Typical fields:
- `actor`, `traceId`, `requestId`
- `planHash`
- `catalog`（適用時スナップショット）
- `summary`（enabled/schemaVersion/nodeCount/edgeCount）
- `createdAt`, `updatedAt`

### journey_todo_items（add-only fields）
- `journeyState`
- `phaseKey`, `domainKey`, `planTier`
- `snoozeUntil`, `lastSignal`
- `stateEvidenceRef`, `stateUpdatedAt`
- `dependencyReasonMap`

Notes:
- 既存 `status=open|completed|skipped` の意味は変更しない。

### journey_branch_queue
Purpose: reaction branch の dispatch 対象を非同期処理する運用キュー（add-only）。  
Typical fields:
- `lineUserId`
- `deliveryId`
- `todoKey`
- `action`
- `plan`
- `ruleId`
- `status` (`pending|sent|failed|skipped`)
- `attempts`
- `nextAttemptAt`
- `branchDispatchStatus`
- `lastError`
- `effect`
- `traceId`, `requestId`, `actor`
- `createdAt`, `updatedAt`, `dispatchedAt`

### notification_deliveries（Phase664 add-only fields）
- `branchRuleId`
- `branchMatchedRuleIds[]`
- `branchQueuedAt`
- `branchDispatchStatus`

### opsConfig/journeyGraphCatalog（Phase664 add-only fields）
- `ruleSet.reactionBranches[]`
  - `ruleId`, `enabled`, `priority`
  - `match.actions[]`, `match.planTiers[]`, `match.todoKeys[]`
  - `match.notificationGroups[]`, `match.phaseKeys[]`, `match.domainKeys[]`
  - `effect.todoPatch`, `effect.todoCreate[]`, `effect.nodeUnlockKeys[]`, `effect.queueDispatch`
- `planUnlocks.free.maxNextActions`
- `planUnlocks.pro.maxNextActions`

## Phase663 Add-only Collections（LINE Rich Menu）

### rich_menu_templates/{templateId}
Purpose: Rich Menu テンプレ契約（kind/target/layout/version）を保持する。  
Typical fields:
- `templateId`
- `kind` (`default|phase|plan|combined`)
- `target` (`planTier|phaseId|locale`)
- `layout` (`size`, `areas[]`)
- `status` (`draft|active|deprecated`)
- `lineMeta` (`richMenuId`, `aliasId`, `imageAssetPath`)
- `version`
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_phase_profiles/{phaseId}
Purpose: Journey stage と Rich Menu phase の写像を保持する。  
Typical fields:
- `phaseId` (`pre_departure|arrival|launch|stabilize|repatriation`)
- `status`
- `journeyStageMatchers[]`
- `label`, `description`
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_assignment_rules/{ruleId}
Purpose: plan/phase/combined の割当ルールを保持する。  
Typical fields:
- `ruleId`
- `kind` (`default|phase|plan|combined`)
- `status`
- `templateId`
- `priority`
- `target` (`planTier|phaseId|locale`)
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

### rich_menu_rollout_runs/{runId}
Purpose: dry-run/apply/rollback の run evidence を保持する。  
Typical fields:
- `runId`
- `action`, `mode`
- `actor`, `traceId`, `requestId`
- `lineUserIds[]`
- `summary`, `results[]`
- `createdAt`, `updatedAt`

### rich_menu_rate_buckets/{yyyyMMddHHmm}
Purpose: 分単位の apply rate-limit カウンタ。  
Typical fields:
- `bucketId`
- `count`
- `maxCount`
- `lastActor`, `lastTraceId`
- `createdAt`, `updatedAt`

### opsConfig/richMenuPolicy（doc）
Purpose: Rich Menu運用ポリシー（kill switch/cooldown/fallback）を保持する。  
Typical fields:
- `enabled`
- `updateEnabled`
- `defaultTemplateId`
- `fallbackTemplateId`
- `cooldownSeconds`
- `maxAppliesPerMinute`
- `maxTargetsPerApply`
- `allowLegacyJourneyPolicyFallback`
- `updatedAt`, `updatedBy`

### rich_menu_bindings/{lineUserId}（add-only fields）
- `currentTemplateId`
- `previousTemplateId`
- `resolvedRuleId`
- `planTier`
- `phaseId`
- `lastApplyResult`
- `lastTraceId`
- `nextEligibleAt`
- `manualOverrideTemplateId`

### `journey_param_versions/{versionId}`
Purpose: Journey制御パラメータのVersion管理（draft/validate/dry-run/apply/rollback）。

Typical fields:
- `state` (`draft|validated|dry_run_passed|applied|rolled_back|rejected`)
- `effectiveAt`
- `parameters.graph`
- `parameters.journeyPolicy`
- `parameters.llmPolicyPatch`
- `validation`
- `dryRun`
- `appliedMeta`

### `journey_param_change_logs/{id}`
Purpose: Journey Param運用の監査証跡（plan/validate/dry_run/apply/rollback）。

Typical fields:
- `versionId`, `action`, `summary`
- `before`, `after`
- `traceId`, `requestId`, `actor`
- `createdAt`

### `opsConfig/journeyParamRuntime`
Purpose: Journey Paramの active/canary pointer 管理。

Typical fields:
- `enabled`
- `activeVersionId`
- `previousAppliedVersionId`
- `canary{ enabled, versionId, lineUserIds[] }`

## Phase740 Add-only Data Map

### `link_registry` add-only fields
- `intentTag` (`task|city_pack|vendor|support|payment|null`)
- `audienceTag` (`family|solo|corporate|null`)
- `regionScope` (`nationwide|state|city|school_district|null`)
- `riskLevel` (`safe|warn|blocked|null`)

### `task_contents` add-only fields
- `summaryShort[]`（最大5）
- `topMistakes[]`（最大3）
- `contextTips[]`（最大5）

### `city_packs` add-only fields
- `modules[]` (`schools|healthcare|driving|housing|utilities`)

### New collection: `user_city_pack_preferences`
- doc id: `lineUserId`
- fields:
  - `modulesSubscribed[]`（空配列=全購読扱い）
  - `updatedAt`, `updatedBy`, `source`

### Notification attention budget read path
- 基準 collection: `notification_deliveries`（SSOT）
- 日次上限計算:
  - `countDeliveredByUserSince(lineUserId, dayStartAt)` を利用
  - `user_journey_profiles.timezone` 優先、未設定は `UTC`

## Phase741 Add-only Data Map

### `step_rules` add-only fields
- `category`
- `estimatedTimeMin`
- `estimatedTimeMax`
- `recommendedVendorLinkIds[]`

### `task_contents` add-only fields
- `category`
- `dependencies[]`
- `checklist[]`
- `recommendedVendorLinkIds[]`
- `archived`

### `city_packs` add-only fields
- `recommendedTasks[]`
  - item: `{ ruleId, module|null, priorityBoost|null }`
- `recordEnvelope`
  - Universal Record Envelope mirror for Canonical Core sidecar emit

### Rich Menu Task OS seed collections
- `rich_menu_templates`
- `rich_menu_assignment_rules`
- `rich_menu_phase_profiles`
- `rich_menu_bindings`
- `opsConfig/richMenuPolicy`

### Link impact read model API
- route: `GET /api/admin/os/link-registry-impact`
- source collections:
  - `link_registry`
  - `task_contents`
  - `notifications`
  - `city_packs`
