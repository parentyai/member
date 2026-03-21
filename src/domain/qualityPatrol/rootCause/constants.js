'use strict';

const ROOT_CAUSE_PROVENANCE = 'quality_patrol_root_cause_analysis';

const ROOT_CAUSE_ANALYSIS_STATUS = Object.freeze({
  analyzed: 'analyzed',
  blocked: 'blocked',
  insufficientEvidence: 'insufficient_evidence'
});

const ROOT_CAUSE_TYPE = Object.freeze({
  observationGap: 'observation_gap',
  transcriptUnavailable: 'transcript_unavailable',
  reviewUnitBlocked: 'review_unit_blocked',
  evidenceInsufficient: 'evidence_insufficient',
  intentCompression: 'intent_compression',
  contextOverride: 'context_override',
  followupCoarsening: 'followup_coarsening',
  clarifyOverselection: 'clarify_overselection',
  detailBlindGeneration: 'detail_blind_generation',
  guardTemplateCollapse: 'guard_template_collapse',
  commandBoundaryMisfire: 'command_boundary_misfire',
  retrievalBlocked: 'retrieval_blocked',
  knowledgeCandidateMissing: 'knowledge_candidate_missing',
  knowledgeCandidateUnused: 'knowledge_candidate_unused',
  readinessRejection: 'readiness_rejection',
  fallbackSelectedOverGrounded: 'fallback_selected_over_grounded',
  finalizerTemplateCollapse: 'finalizer_template_collapse',
  followupContextLoss: 'followup_context_loss',
  citySpecificityGap: 'city_specificity_gap',
  proceduralGuidanceGap: 'procedural_guidance_gap',
  observationOnlyNoRuntimeInference: 'observation_only_no_runtime_inference',
  blockedByMissingContext: 'blocked_by_missing_context',
  blockedByUnavailableData: 'blocked_by_unavailable_data'
});

const CONCIERGE_ISSUE_CODES = Object.freeze([
  'emergency_high_risk',
  'saved_faq_high_risk_reuse',
  'journey_blocker_conflict',
  'stale_city_pack_required_source',
  'compat_spike',
  'trace_join_incomplete',
  'direct_url_leakage',
  'official_source_missing_on_high_risk'
]);

const CONCIERGE_ISSUE_CAUSE_TYPES = Object.freeze({
  emergency_high_risk: ROOT_CAUSE_TYPE.readinessRejection,
  saved_faq_high_risk_reuse: ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  journey_blocker_conflict: ROOT_CAUSE_TYPE.blockedByMissingContext,
  stale_city_pack_required_source: ROOT_CAUSE_TYPE.citySpecificityGap,
  compat_spike: ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded,
  trace_join_incomplete: ROOT_CAUSE_TYPE.observationGap,
  direct_url_leakage: ROOT_CAUSE_TYPE.readinessRejection,
  official_source_missing_on_high_risk: ROOT_CAUSE_TYPE.readinessRejection
});

const CONCIERGE_ISSUE_LABELS = Object.freeze({
  emergency_high_risk: 'Emergency high-risk handling is missing the required official-source gate.',
  saved_faq_high_risk_reuse: 'High-risk saved FAQ reuse is not following the source contract.',
  journey_blocker_conflict: 'Journey blockers are conflicting with the selected answer path.',
  stale_city_pack_required_source: 'City Pack freshness or authority is stale for a required source.',
  compat_spike: 'Compatibility pressure is pushing the release gate above the allowed window.',
  trace_join_incomplete: 'Trace joins are incomplete for concierge runtime attribution.',
  direct_url_leakage: 'Direct URL leakage is still being observed.',
  official_source_missing_on_high_risk: 'High-risk responses are missing the required official source.'
});

const ROOT_CAUSE_LABELS = Object.freeze({
  [ROOT_CAUSE_TYPE.observationGap]: 'Observation coverage gap is blocking root-cause judgement.',
  [ROOT_CAUSE_TYPE.transcriptUnavailable]: 'Transcript or reply evidence is unavailable.',
  [ROOT_CAUSE_TYPE.reviewUnitBlocked]: 'Review-unit level blockers are preventing confident analysis.',
  [ROOT_CAUSE_TYPE.evidenceInsufficient]: 'Evidence is insufficient to attribute a runtime cause confidently.',
  [ROOT_CAUSE_TYPE.intentCompression]: 'Multi-intent or output-form signals were compressed into an overly coarse intent.',
  [ROOT_CAUSE_TYPE.contextOverride]: 'Prior context overrode the current-turn correction or explicit user detail.',
  [ROOT_CAUSE_TYPE.followupCoarsening]: 'Follow-up handling collapsed into a coarse continuation or echo instead of advancing the answer.',
  [ROOT_CAUSE_TYPE.clarifyOverselection]: 'Clarify behavior was selected even though the request was already answerable.',
  [ROOT_CAUSE_TYPE.detailBlindGeneration]: 'Generation ignored explicit detail and output-form obligations from the current turn.',
  [ROOT_CAUSE_TYPE.guardTemplateCollapse]: 'Final guard/fallback shaping collapsed the reply back into a generic template.',
  [ROOT_CAUSE_TYPE.commandBoundaryMisfire]: 'Natural-language traffic collided with a command-only boundary or control path.',
  [ROOT_CAUSE_TYPE.retrievalBlocked]: 'Retrieval was blocked before grounded candidates could be used.',
  [ROOT_CAUSE_TYPE.knowledgeCandidateMissing]: 'Grounded knowledge candidates were not available for selection.',
  [ROOT_CAUSE_TYPE.knowledgeCandidateUnused]: 'Knowledge candidates existed but were not used in the answer path.',
  [ROOT_CAUSE_TYPE.readinessRejection]: 'Readiness gating prevented a direct grounded answer.',
  [ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded]: 'Fallback output was selected over available grounded candidates.',
  [ROOT_CAUSE_TYPE.finalizerTemplateCollapse]: 'Finalizer/template collapse is driving repetitive reply structure.',
  [ROOT_CAUSE_TYPE.followupContextLoss]: 'Follow-up context was not carried into the final answer.',
  [ROOT_CAUSE_TYPE.citySpecificityGap]: 'City-specific grounding was too weak for the detected slice.',
  [ROOT_CAUSE_TYPE.proceduralGuidanceGap]: 'Concrete next-step guidance was missing from the answer path.',
  [ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference]: 'Only observation-side evidence is available; runtime inference is blocked.',
  [ROOT_CAUSE_TYPE.blockedByMissingContext]: 'Missing prior context is blocking confident follow-up analysis.',
  [ROOT_CAUSE_TYPE.blockedByUnavailableData]: 'Unavailable runtime data is blocking confident attribution.'
});

const CAUSE_PRIORITY = Object.freeze([
  ROOT_CAUSE_TYPE.observationGap,
  ROOT_CAUSE_TYPE.transcriptUnavailable,
  ROOT_CAUSE_TYPE.reviewUnitBlocked,
  ROOT_CAUSE_TYPE.blockedByMissingContext,
  ROOT_CAUSE_TYPE.blockedByUnavailableData,
  ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference,
  ROOT_CAUSE_TYPE.intentCompression,
  ROOT_CAUSE_TYPE.contextOverride,
  ROOT_CAUSE_TYPE.followupCoarsening,
  ROOT_CAUSE_TYPE.clarifyOverselection,
  ROOT_CAUSE_TYPE.detailBlindGeneration,
  ROOT_CAUSE_TYPE.guardTemplateCollapse,
  ROOT_CAUSE_TYPE.commandBoundaryMisfire,
  ROOT_CAUSE_TYPE.retrievalBlocked,
  ROOT_CAUSE_TYPE.readinessRejection,
  ROOT_CAUSE_TYPE.knowledgeCandidateMissing,
  ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded,
  ROOT_CAUSE_TYPE.finalizerTemplateCollapse,
  ROOT_CAUSE_TYPE.followupContextLoss,
  ROOT_CAUSE_TYPE.citySpecificityGap,
  ROOT_CAUSE_TYPE.proceduralGuidanceGap,
  ROOT_CAUSE_TYPE.evidenceInsufficient
]);

const TRANSCRIPT_AVAILABILITY_METRICS = Object.freeze([
  'reviewableTranscriptRate',
  'userMessageAvailableRate',
  'assistantReplyAvailableRate',
  'priorContextSummaryAvailableRate',
  'transcriptAvailability'
]);

const CONTEXT_BLOCKER_CODES = Object.freeze([
  'missing_prior_context_summary',
  'insufficient_context_for_followup_judgement'
]);

const UNAVAILABLE_BLOCKER_CODES = Object.freeze([
  'missing_user_message',
  'missing_assistant_reply',
  'missing_trace_evidence',
  'missing_action_log_evidence',
  'missing_faq_evidence',
  'transcript_not_reviewable'
]);

const OBSERVATION_BLOCKER_METRICS = Object.freeze([
  'observationBlockerRate',
  'blockedFollowupJudgementRate',
  'blockedKnowledgeJudgementRate'
]);

const KNOWLEDGE_METRICS = Object.freeze([
  'knowledgeUse',
  'knowledgeActivationMissingRate',
  'savedFaqUnusedRate',
  'cityPackUnusedRate'
]);

const CITY_SPECIFICITY_METRICS = Object.freeze([
  'specificity',
  'citySpecificityMissingRate'
]);

const PROCEDURAL_METRICS = Object.freeze([
  'proceduralUtility',
  'nextStepMissingRate'
]);

const CONTINUITY_METRICS = Object.freeze([
  'continuity',
  'followupContextResetRate'
]);

const REPETITION_METRICS = Object.freeze([
  'fallbackRepetition',
  'repeatedTemplateResponseRate'
]);

const FIXED_ROOT_CAUSE_BY_METRIC = Object.freeze({
  conciergeDirectAnswerMissingRate: ROOT_CAUSE_TYPE.readinessRejection,
  conciergeContextCarryMissingRate: ROOT_CAUSE_TYPE.followupContextLoss,
  conciergeKnowledgeBypassRate: ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  conciergeTemplateOveruseRate: ROOT_CAUSE_TYPE.finalizerTemplateCollapse,
  genericLoopFixedReplyRate: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  detailFormatDropRate: ROOT_CAUSE_TYPE.detailBlindGeneration,
  correctionIgnoredRate: ROOT_CAUSE_TYPE.contextOverride,
  mixedDomainCollapseRate: ROOT_CAUSE_TYPE.intentCompression,
  followupOveraskRate: ROOT_CAUSE_TYPE.clarifyOverselection,
  internalLabelLeakRate: ROOT_CAUSE_TYPE.detailBlindGeneration,
  commandBoundaryCollisionRate: ROOT_CAUSE_TYPE.commandBoundaryMisfire,
  punctuationAnomalyRate: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  parrotEchoRate: ROOT_CAUSE_TYPE.followupCoarsening
});

const FIXED_ROOT_CAUSE_BY_CATEGORY = Object.freeze({
  concierge_direct_answer_missing: ROOT_CAUSE_TYPE.readinessRejection,
  concierge_context_carry_missing: ROOT_CAUSE_TYPE.followupContextLoss,
  concierge_knowledge_bypass: ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  concierge_template_overuse: ROOT_CAUSE_TYPE.finalizerTemplateCollapse,
  generic_loop_fixed_reply: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  detail_format_drop: ROOT_CAUSE_TYPE.detailBlindGeneration,
  correction_ignored: ROOT_CAUSE_TYPE.contextOverride,
  mixed_domain_collapse: ROOT_CAUSE_TYPE.intentCompression,
  followup_overask: ROOT_CAUSE_TYPE.clarifyOverselection,
  internal_label_leak: ROOT_CAUSE_TYPE.detailBlindGeneration,
  command_boundary_collision: ROOT_CAUSE_TYPE.commandBoundaryMisfire,
  punctuation_anomaly: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  parrot_echo: ROOT_CAUSE_TYPE.followupCoarsening
});

const FIXED_ROOT_CAUSE_BY_ISSUE_CODE = Object.freeze({
  QP_CONCIERGE_DIRECT_ANSWER_MISSING: ROOT_CAUSE_TYPE.readinessRejection,
  QP_CONCIERGE_CONTEXT_CARRY_MISSING: ROOT_CAUSE_TYPE.followupContextLoss,
  QP_CONCIERGE_KNOWLEDGE_BYPASS: ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  QP_CONCIERGE_TEMPLATE_OVERUSE: ROOT_CAUSE_TYPE.finalizerTemplateCollapse,
  QP_GENERIC_LOOP_FIXED_REPLY: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  QP_DETAIL_FORMAT_DROP: ROOT_CAUSE_TYPE.detailBlindGeneration,
  QP_CORRECTION_IGNORED: ROOT_CAUSE_TYPE.contextOverride,
  QP_MIXED_DOMAIN_COLLAPSE: ROOT_CAUSE_TYPE.intentCompression,
  QP_FOLLOWUP_OVERASK: ROOT_CAUSE_TYPE.clarifyOverselection,
  QP_INTERNAL_LABEL_LEAK: ROOT_CAUSE_TYPE.detailBlindGeneration,
  QP_COMMAND_BOUNDARY_COLLISION: ROOT_CAUSE_TYPE.commandBoundaryMisfire,
  QP_PUNCTUATION_ANOMALY: ROOT_CAUSE_TYPE.guardTemplateCollapse,
  QP_PARROT_ECHO: ROOT_CAUSE_TYPE.followupCoarsening
});

module.exports = {
  ROOT_CAUSE_PROVENANCE,
  ROOT_CAUSE_ANALYSIS_STATUS,
  ROOT_CAUSE_TYPE,
  CONCIERGE_ISSUE_CODES,
  CONCIERGE_ISSUE_CAUSE_TYPES,
  CONCIERGE_ISSUE_LABELS,
  ROOT_CAUSE_LABELS,
  CAUSE_PRIORITY,
  TRANSCRIPT_AVAILABILITY_METRICS,
  CONTEXT_BLOCKER_CODES,
  UNAVAILABLE_BLOCKER_CODES,
  OBSERVATION_BLOCKER_METRICS,
  KNOWLEDGE_METRICS,
  CITY_SPECIFICITY_METRICS,
  PROCEDURAL_METRICS,
  CONTINUITY_METRICS,
  REPETITION_METRICS,
  FIXED_ROOT_CAUSE_BY_METRIC,
  FIXED_ROOT_CAUSE_BY_CATEGORY,
  FIXED_ROOT_CAUSE_BY_ISSUE_CODE
};
