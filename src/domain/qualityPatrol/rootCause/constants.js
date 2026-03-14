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

const ROOT_CAUSE_LABELS = Object.freeze({
  [ROOT_CAUSE_TYPE.observationGap]: 'Observation coverage gap is blocking root-cause judgement.',
  [ROOT_CAUSE_TYPE.transcriptUnavailable]: 'Transcript or reply evidence is unavailable.',
  [ROOT_CAUSE_TYPE.reviewUnitBlocked]: 'Review-unit level blockers are preventing confident analysis.',
  [ROOT_CAUSE_TYPE.evidenceInsufficient]: 'Evidence is insufficient to attribute a runtime cause confidently.',
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

module.exports = {
  ROOT_CAUSE_PROVENANCE,
  ROOT_CAUSE_ANALYSIS_STATUS,
  ROOT_CAUSE_TYPE,
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
  REPETITION_METRICS
};
