'use strict';

const { KPI_THRESHOLDS } = require('../kpi/constants');

const DETECTION_PROVENANCE = 'quality_patrol_detection';

const DETECTION_CONFIDENCE = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high'
});

const DETECTION_STATUS = Object.freeze({
  open: 'open',
  watching: 'watching',
  blocked: 'blocked',
  resolved: 'resolved'
});

const DETECTION_SEVERITY = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical'
});

const ISSUE_TYPE_BY_METRIC = Object.freeze({
  naturalness: 'conversation_quality',
  continuity: 'continuity',
  specificity: 'specificity',
  proceduralUtility: 'procedural_utility',
  knowledgeUse: 'knowledge_activation',
  fallbackRepetition: 'fallback_repetition',
  reviewableTranscriptRate: 'observation_blocker',
  userMessageAvailableRate: 'observation_blocker',
  assistantReplyAvailableRate: 'observation_blocker',
  priorContextSummaryAvailableRate: 'observation_blocker',
  transcriptAvailability: 'observation_blocker',
  observationBlockerRate: 'observation_blocker',
  blockedFollowupJudgementRate: 'observation_blocker',
  blockedKnowledgeJudgementRate: 'observation_blocker',
  broadAbstractEscapeRate: 'conversation_quality',
  followupContextResetRate: 'continuity',
  citySpecificityMissingRate: 'specificity',
  nextStepMissingRate: 'procedural_utility',
  repeatedTemplateResponseRate: 'fallback_repetition',
  knowledgeActivationMissingRate: 'knowledge_activation',
  savedFaqUnusedRate: 'knowledge_activation',
  cityPackUnusedRate: 'knowledge_activation'
});

const CATEGORY_BY_METRIC = Object.freeze({
  naturalness: 'naturalness_degraded',
  continuity: 'continuity_degraded',
  specificity: 'specificity_degraded',
  proceduralUtility: 'procedural_utility_degraded',
  knowledgeUse: 'knowledge_use_degraded',
  fallbackRepetition: 'fallback_repetition_elevated',
  reviewableTranscriptRate: 'reviewable_transcript_rate_low',
  userMessageAvailableRate: 'user_message_availability_low',
  assistantReplyAvailableRate: 'assistant_reply_availability_low',
  priorContextSummaryAvailableRate: 'prior_context_availability_low',
  transcriptAvailability: 'transcript_availability_low',
  observationBlockerRate: 'observation_blocker_rate_high',
  blockedFollowupJudgementRate: 'followup_judgement_blocked',
  blockedKnowledgeJudgementRate: 'knowledge_judgement_blocked',
  broadAbstractEscapeRate: 'broad_abstract_escape',
  followupContextResetRate: 'followup_context_reset',
  citySpecificityMissingRate: 'city_specificity_missing',
  nextStepMissingRate: 'next_step_missing',
  repeatedTemplateResponseRate: 'repeated_template_response',
  knowledgeActivationMissingRate: 'knowledge_activation_missing',
  savedFaqUnusedRate: 'saved_faq_unused',
  cityPackUnusedRate: 'city_pack_unused'
});

const TITLE_BY_METRIC = Object.freeze({
  naturalness: 'Japanese naturalness is degrading',
  continuity: 'Follow-up continuity is degrading',
  specificity: 'Answer specificity is degrading',
  proceduralUtility: 'Procedural utility is degrading',
  knowledgeUse: 'Knowledge activation is weak',
  fallbackRepetition: 'Fallback repetition risk is elevated',
  reviewableTranscriptRate: 'Reviewable transcript coverage is low',
  userMessageAvailableRate: 'User message coverage is low',
  assistantReplyAvailableRate: 'Assistant reply coverage is low',
  priorContextSummaryAvailableRate: 'Prior context coverage is low',
  transcriptAvailability: 'Transcript availability is low',
  observationBlockerRate: 'Observation blockers are elevated',
  blockedFollowupJudgementRate: 'Follow-up judgement is blocked',
  blockedKnowledgeJudgementRate: 'Knowledge judgement is blocked',
  broadAbstractEscapeRate: 'Broad answers are drifting into abstraction',
  followupContextResetRate: 'Follow-up answers are resetting context',
  citySpecificityMissingRate: 'City answers are missing specificity',
  nextStepMissingRate: 'Concrete next steps are missing',
  repeatedTemplateResponseRate: 'Repeated template responses are elevated',
  knowledgeActivationMissingRate: 'Knowledge activation is missing',
  savedFaqUnusedRate: 'Saved FAQ reuse is missing',
  cityPackUnusedRate: 'City Pack reuse is missing'
});

const BACKLOG_TEMPLATE_BY_METRIC = Object.freeze({
  naturalness: { title: 'Conversation naturalness repair', priority: 'P2', objective: 'Reduce machine-like phrasing and improve Japanese naturalness in replies.' },
  continuity: { title: 'Follow-up continuity repair', priority: 'P1', objective: 'Improve follow-up continuity so prior context is not reset.' },
  specificity: { title: 'Specificity grounding repair', priority: 'P1', objective: 'Increase grounded specificity in answers, especially for city and housing slices.' },
  proceduralUtility: { title: 'Procedural utility repair', priority: 'P1', objective: 'Ensure replies provide concrete next actions and execution order.' },
  knowledgeUse: { title: 'Knowledge activation repair', priority: 'P1', objective: 'Increase usage of available FAQ, saved FAQ, and City Pack knowledge signals.' },
  fallbackRepetition: { title: 'Fallback template diversification', priority: 'P1', objective: 'Reduce repeated fallback skeletons and diversify response templates.' },
  reviewableTranscriptRate: { title: 'Transcript coverage repair', priority: 'P1', objective: 'Raise reviewable transcript coverage for conversation quality patrol.' },
  userMessageAvailableRate: { title: 'Transcript coverage repair', priority: 'P1', objective: 'Raise reviewable transcript coverage for conversation quality patrol.' },
  assistantReplyAvailableRate: { title: 'Transcript coverage repair', priority: 'P1', objective: 'Raise reviewable transcript coverage for conversation quality patrol.' },
  priorContextSummaryAvailableRate: { title: 'Follow-up context coverage repair', priority: 'P1', objective: 'Improve prior-context coverage for follow-up reviewability.' },
  transcriptAvailability: { title: 'Transcript coverage repair', priority: 'P1', objective: 'Raise transcript availability so evaluator coverage is reliable.' },
  observationBlockerRate: { title: 'Observation coverage repair', priority: 'P1', objective: 'Reduce observation blockers so patrol can judge quality confidently.' },
  blockedFollowupJudgementRate: { title: 'Follow-up observation repair', priority: 'P1', objective: 'Reduce follow-up judgement blockers by improving context evidence availability.' },
  blockedKnowledgeJudgementRate: { title: 'Knowledge observation repair', priority: 'P1', objective: 'Reduce knowledge judgement blockers by improving candidate/evidence availability.' },
  broadAbstractEscapeRate: { title: 'Broad answer utility repair', priority: 'P1', objective: 'Prevent broad answers from collapsing into generic abstraction.' },
  followupContextResetRate: { title: 'Follow-up continuity repair', priority: 'P1', objective: 'Reduce follow-up context resets and preserve prior context in answers.' },
  citySpecificityMissingRate: { title: 'City grounding selection repair', priority: 'P1', objective: 'Increase city-specific grounding and City Pack usage in city answers.' },
  nextStepMissingRate: { title: 'Next-step utility repair', priority: 'P1', objective: 'Ensure answers end with concrete next-step guidance.' },
  repeatedTemplateResponseRate: { title: 'Fallback template diversification', priority: 'P1', objective: 'Reduce repeated template responses in generic fallback paths.' },
  knowledgeActivationMissingRate: { title: 'Knowledge activation repair', priority: 'P1', objective: 'Increase activation of available knowledge-backed candidates.' },
  savedFaqUnusedRate: { title: 'Saved FAQ activation repair', priority: 'P2', objective: 'Increase reuse of saved FAQ candidates when they are available.' },
  cityPackUnusedRate: { title: 'City Pack activation repair', priority: 'P1', objective: 'Increase reuse of City Pack candidates when they are available.' }
});

const METRIC_THRESHOLDS = Object.freeze({
  naturalness: KPI_THRESHOLDS.signal,
  continuity: KPI_THRESHOLDS.signal,
  specificity: KPI_THRESHOLDS.signal,
  proceduralUtility: KPI_THRESHOLDS.signal,
  knowledgeUse: KPI_THRESHOLDS.signal,
  fallbackRepetition: KPI_THRESHOLDS.repetitionRisk,
  reviewableTranscriptRate: KPI_THRESHOLDS.availability,
  userMessageAvailableRate: KPI_THRESHOLDS.availability,
  assistantReplyAvailableRate: KPI_THRESHOLDS.availability,
  priorContextSummaryAvailableRate: KPI_THRESHOLDS.availability,
  transcriptAvailability: KPI_THRESHOLDS.availability,
  observationBlockerRate: KPI_THRESHOLDS.blockerRate,
  blockedFollowupJudgementRate: KPI_THRESHOLDS.blockerRate,
  blockedKnowledgeJudgementRate: KPI_THRESHOLDS.blockerRate,
  broadAbstractEscapeRate: KPI_THRESHOLDS.issueRate,
  followupContextResetRate: KPI_THRESHOLDS.issueRate,
  citySpecificityMissingRate: KPI_THRESHOLDS.issueRate,
  nextStepMissingRate: KPI_THRESHOLDS.issueRate,
  repeatedTemplateResponseRate: KPI_THRESHOLDS.issueRate,
  knowledgeActivationMissingRate: KPI_THRESHOLDS.issueRate,
  savedFaqUnusedRate: KPI_THRESHOLDS.issueRate,
  cityPackUnusedRate: KPI_THRESHOLDS.issueRate
});

const SIGNAL_METRIC_KEYS = Object.freeze([
  'naturalness',
  'continuity',
  'specificity',
  'proceduralUtility',
  'knowledgeUse',
  'fallbackRepetition'
]);

const AVAILABILITY_METRIC_KEYS = Object.freeze([
  'reviewableTranscriptRate',
  'userMessageAvailableRate',
  'assistantReplyAvailableRate',
  'priorContextSummaryAvailableRate',
  'transcriptAvailability'
]);

const BLOCKER_METRIC_KEYS = Object.freeze([
  'observationBlockerRate',
  'blockedFollowupJudgementRate',
  'blockedKnowledgeJudgementRate'
]);

const ISSUE_RATE_METRIC_KEYS = Object.freeze([
  'broadAbstractEscapeRate',
  'followupContextResetRate',
  'citySpecificityMissingRate',
  'nextStepMissingRate',
  'repeatedTemplateResponseRate',
  'knowledgeActivationMissingRate',
  'savedFaqUnusedRate',
  'cityPackUnusedRate'
]);

module.exports = {
  DETECTION_PROVENANCE,
  DETECTION_CONFIDENCE,
  DETECTION_STATUS,
  DETECTION_SEVERITY,
  ISSUE_TYPE_BY_METRIC,
  CATEGORY_BY_METRIC,
  TITLE_BY_METRIC,
  BACKLOG_TEMPLATE_BY_METRIC,
  METRIC_THRESHOLDS,
  SIGNAL_METRIC_KEYS,
  AVAILABILITY_METRIC_KEYS,
  BLOCKER_METRIC_KEYS,
  ISSUE_RATE_METRIC_KEYS
};
