'use strict';

const crypto = require('node:crypto');
const { ROOT_CAUSE_TYPE } = require('../rootCause/constants');

const IMPROVEMENT_PLAN_VERSION = 'quality_patrol_improvement_plan_v1';
const IMPROVEMENT_PLANNER_PROVENANCE = 'quality_patrol_improvement_planner';

const PROPOSAL_TYPE = Object.freeze({
  observationOnly: 'observation_only',
  sampleCollection: 'sample_collection',
  transcriptCoverageRepair: 'transcript_coverage_repair',
  knowledgeFix: 'knowledge_fix',
  readinessFix: 'readiness_fix',
  templateFix: 'template_fix',
  continuityFix: 'continuity_fix',
  specificityFix: 'specificity_fix',
  retrievalFix: 'retrieval_fix',
  runtimeFix: 'runtime_fix',
  noActionUntilEvidence: 'no_action_until_evidence',
  blockedByObservationGap: 'blocked_by_observation_gap'
});

const PROPOSAL_RISK = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high'
});

const PROPOSAL_PRIORITY = Object.freeze({
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
});

const OBSERVATION_PROPOSAL_TYPES = Object.freeze([
  PROPOSAL_TYPE.observationOnly,
  PROPOSAL_TYPE.sampleCollection,
  PROPOSAL_TYPE.transcriptCoverageRepair,
  PROPOSAL_TYPE.noActionUntilEvidence,
  PROPOSAL_TYPE.blockedByObservationGap
]);

const TARGET_FILE_MAP = Object.freeze({
  [PROPOSAL_TYPE.knowledgeFix]: [
    'src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates.js',
    'src/domain/llm/knowledge/resolveCityIntentGrounding.js',
    'src/domain/llm/orchestrator/candidatePriority.js',
    'src/domain/llm/orchestrator/runPaidConversationOrchestrator.js'
  ],
  [PROPOSAL_TYPE.readinessFix]: [
    'src/domain/llm/quality/evaluateAnswerReadiness.js',
    'src/domain/llm/quality/runAnswerReadinessGateV2.js',
    'src/domain/llm/quality/resolveSharedAnswerReadiness.js'
  ],
  [PROPOSAL_TYPE.templateFix]: [
    'src/domain/llm/orchestrator/finalizeCandidate.js',
    'src/domain/llm/orchestrator/verifyCandidate.js',
    'src/domain/llm/conversation/paidReplyGuard.js'
  ],
  [PROPOSAL_TYPE.continuityFix]: [
    'src/domain/llm/orchestrator/buildRequestContract.js',
    'src/domain/llm/orchestrator/buildConversationPacket.js',
    'src/domain/llm/orchestrator/followupIntentResolver.js',
    'src/domain/llm/orchestrator/strategyPlanner.js',
    'src/domain/llm/orchestrator/runPaidConversationOrchestrator.js'
  ],
  [PROPOSAL_TYPE.specificityFix]: [
    'src/domain/llm/knowledge/resolveCityIntentGrounding.js',
    'src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates.js',
    'src/domain/llm/orchestrator/runPaidConversationOrchestrator.js'
  ],
  [PROPOSAL_TYPE.retrievalFix]: [
    'src/domain/llm/orchestrator/retrievalController.js',
    'src/domain/llm/orchestrator/candidatePriority.js',
    'src/domain/llm/orchestrator/runPaidConversationOrchestrator.js'
  ],
  [PROPOSAL_TYPE.runtimeFix]: [
    'src/domain/llm/orchestrator/buildRequestContract.js',
    'src/domain/llm/orchestrator/runPaidConversationOrchestrator.js',
    'src/domain/llm/orchestrator/candidatePriority.js',
    'src/domain/llm/orchestrator/verifyCandidate.js',
    'src/usecases/assistant/generatePaidDomainConciergeReply.js',
    'src/usecases/assistant/generatePaidCasualReply.js',
    'src/routes/webhookLine.js'
  ],
  [PROPOSAL_TYPE.observationOnly]: [
    'docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md',
    'docs/QUALITY_PATROL_REVIEW_UNITS_RUNBOOK.md',
    'docs/QUALITY_PATROL_ROOT_CAUSE_RUNBOOK.md'
  ],
  [PROPOSAL_TYPE.sampleCollection]: [
    'docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md',
    'src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources.js',
    'src/domain/qualityPatrol/transcript/buildObservationBlockers.js'
  ],
  [PROPOSAL_TYPE.transcriptCoverageRepair]: [
    'src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources.js',
    'src/domain/qualityPatrol/transcript/buildConversationReviewUnits.js',
    'docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md'
  ],
  [PROPOSAL_TYPE.noActionUntilEvidence]: [
    'docs/QUALITY_PATROL_ROOT_CAUSE_RUNBOOK.md',
    'docs/QUALITY_PATROL_DETECTION_RUNBOOK.md'
  ],
  [PROPOSAL_TYPE.blockedByObservationGap]: [
    'docs/QUALITY_PATROL_ROOT_CAUSE_RUNBOOK.md',
    'docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md'
  ]
});

const EXPECTED_IMPACT_MAP = Object.freeze({
  [PROPOSAL_TYPE.knowledgeFix]: ['knowledgeUse should improve', 'savedFaqUnusedRate / cityPackUnusedRate should decrease'],
  [PROPOSAL_TYPE.readinessFix]: ['readiness-related blocker rates should decrease', 'knowledgeUse and proceduralUtility should recover'],
  [PROPOSAL_TYPE.templateFix]: ['fallbackRepetition should decrease', 'naturalness should improve'],
  [PROPOSAL_TYPE.continuityFix]: ['continuity should improve', 'followupContextResetRate should decrease'],
  [PROPOSAL_TYPE.specificityFix]: ['specificity should improve', 'citySpecificityMissingRate should decrease'],
  [PROPOSAL_TYPE.retrievalFix]: ['retrieval-related blockers should decrease', 'knowledge activation opportunities should increase'],
  [PROPOSAL_TYPE.runtimeFix]: ['proceduralUtility should improve', 'nextStepMissingRate should decrease', 'detail/output-form failures should decrease'],
  [PROPOSAL_TYPE.observationOnly]: ['observationBlockerRate should decrease', 'planner confidence should increase'],
  [PROPOSAL_TYPE.sampleCollection]: ['reviewableTranscriptRate should increase', 'blockedFollowupJudgementRate should decrease'],
  [PROPOSAL_TYPE.transcriptCoverageRepair]: ['transcriptAvailability should improve', 'reviewableTranscriptRate should increase'],
  [PROPOSAL_TYPE.noActionUntilEvidence]: ['evidence gaps should shrink before runtime fixes are attempted'],
  [PROPOSAL_TYPE.blockedByObservationGap]: ['observation blockers should be cleared before runtime proposals are promoted']
});

const PROPOSAL_TEMPLATE_BY_CAUSE = Object.freeze({
  [ROOT_CAUSE_TYPE.observationGap]: {
    proposalType: PROPOSAL_TYPE.blockedByObservationGap,
    title: 'Quality Patrol observation gap unblocker',
    objective: 'Close observation gaps before proposing runtime fixes.',
    whyNotOthers: 'Runtime fixes are deferred because evidence collection is currently blocking confident attribution.'
  },
  [ROOT_CAUSE_TYPE.transcriptUnavailable]: {
    proposalType: PROPOSAL_TYPE.transcriptCoverageRepair,
    title: 'Transcript coverage repair',
    objective: 'Improve transcript availability and reviewable snapshot coverage for Quality Patrol.',
    whyNotOthers: 'Knowledge or template fixes would be speculative until transcript coverage recovers.'
  },
  [ROOT_CAUSE_TYPE.reviewUnitBlocked]: {
    proposalType: PROPOSAL_TYPE.sampleCollection,
    title: 'Review-unit sample collection repair',
    objective: 'Reduce blocker-heavy review units so root-cause analysis can run on complete evidence.',
    whyNotOthers: 'Runtime fixes are deferred until blocked review units stop hiding the actual cause.'
  },
  [ROOT_CAUSE_TYPE.evidenceInsufficient]: {
    proposalType: PROPOSAL_TYPE.noActionUntilEvidence,
    title: 'Evidence-first follow-up plan',
    objective: 'Collect stronger evidence before opening a runtime-quality repair track.',
    whyNotOthers: 'A runtime fix would overfit to weak evidence.'
  },
  [ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference]: {
    proposalType: PROPOSAL_TYPE.noActionUntilEvidence,
    title: 'Observation-first follow-up plan',
    objective: 'Add enough runtime evidence to move from observation-only analysis to actionable fixes.',
    whyNotOthers: 'Root-cause inference is still blocked by missing runtime telemetry.'
  },
  [ROOT_CAUSE_TYPE.blockedByMissingContext]: {
    proposalType: PROPOSAL_TYPE.sampleCollection,
    title: 'Follow-up context coverage repair',
    objective: 'Improve prior-context capture so follow-up issues can be attributed confidently.',
    whyNotOthers: 'Continuity fixes are premature while context evidence is missing.'
  },
  [ROOT_CAUSE_TYPE.blockedByUnavailableData]: {
    proposalType: PROPOSAL_TYPE.transcriptCoverageRepair,
    title: 'Unavailable-data coverage repair',
    objective: 'Recover unavailable runtime and transcript evidence before suggesting runtime changes.',
    whyNotOthers: 'Runtime changes would be guesswork while required data stays unavailable.'
  },
  [ROOT_CAUSE_TYPE.knowledgeCandidateMissing]: {
    proposalType: PROPOSAL_TYPE.knowledgeFix,
    title: 'Knowledge candidate generation repair',
    objective: 'Increase creation of grounded knowledge candidates before fallback selection begins.',
    whyNotOthers: 'Selection tuning alone cannot help when candidate supply is missing.'
  },
  [ROOT_CAUSE_TYPE.knowledgeCandidateUnused]: {
    proposalType: PROPOSAL_TYPE.knowledgeFix,
    title: 'Knowledge selection repair',
    objective: 'Prefer grounded knowledge candidates when they are already available.',
    whyNotOthers: 'Observation repair is no longer the bottleneck; selection logic is.'
  },
  [ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded]: {
    proposalType: PROPOSAL_TYPE.knowledgeFix,
    title: 'Grounded-over-fallback selection repair',
    objective: 'Reduce cases where fallback answers win over grounded candidates.',
    whyNotOthers: 'Template tuning alone will not fix grounded candidates being skipped.'
  },
  [ROOT_CAUSE_TYPE.readinessRejection]: {
    proposalType: PROPOSAL_TYPE.readinessFix,
    title: 'Answer readiness tuning repair',
    objective: 'Rebalance readiness enforcement so grounded answers are not rejected too aggressively.',
    whyNotOthers: 'Knowledge fixes will not help if readiness blocks grounded answers downstream.'
  },
  [ROOT_CAUSE_TYPE.finalizerTemplateCollapse]: {
    proposalType: PROPOSAL_TYPE.templateFix,
    title: 'Finalizer template diversification',
    objective: 'Reduce repetitive finalizer and guard template collapse in reply shaping.',
    whyNotOthers: 'Selection or retrieval changes will not diversify the final response skeleton by themselves.'
  },
  [ROOT_CAUSE_TYPE.followupContextLoss]: {
    proposalType: PROPOSAL_TYPE.continuityFix,
    title: 'Follow-up continuity repair',
    objective: 'Carry prior context through packet building and follow-up resolution more reliably.',
    whyNotOthers: 'Template or readiness changes will not restore dropped follow-up context.'
  },
  [ROOT_CAUSE_TYPE.intentCompression]: {
    proposalType: PROPOSAL_TYPE.runtimeFix,
    title: 'Request-contract intent expansion repair',
    objective: 'Preserve mixed-domain, correction, and output-form signals before strategy selection.',
    whyNotOthers: 'Continuity or template tuning alone will not recover detail that was compressed out of the request contract.'
  },
  [ROOT_CAUSE_TYPE.contextOverride]: {
    proposalType: PROPOSAL_TYPE.continuityFix,
    title: 'Current-turn correction supremacy repair',
    objective: 'Keep current-turn corrections and explicit detail above prior-context carry when the packet is built.',
    whyNotOthers: 'Runtime generation changes will keep drifting if packet-level context precedence is still wrong.'
  },
  [ROOT_CAUSE_TYPE.followupCoarsening]: {
    proposalType: PROPOSAL_TYPE.continuityFix,
    title: 'Follow-up anti-coarsening repair',
    objective: 'Prevent answerable follow-ups from collapsing into generic continuation or echo responses.',
    whyNotOthers: 'Template diversification alone will not stop the planner from flattening the follow-up path.'
  },
  [ROOT_CAUSE_TYPE.clarifyOverselection]: {
    proposalType: PROPOSAL_TYPE.runtimeFix,
    title: 'Clarify over-selection suppression',
    objective: 'Limit clarify selection to requests that truly need more context or high-risk gating.',
    whyNotOthers: 'Readiness tuning is not sufficient when answerable requests are misrouted before candidate release.'
  },
  [ROOT_CAUSE_TYPE.detailBlindGeneration]: {
    proposalType: PROPOSAL_TYPE.runtimeFix,
    title: 'Detail-obligation generation repair',
    objective: 'Force reply generation and verification to respect output form, reasons, and mixed-domain obligations.',
    whyNotOthers: 'Continuity-only changes will not restore dropped output-form and detail requirements.'
  },
  [ROOT_CAUSE_TYPE.guardTemplateCollapse]: {
    proposalType: PROPOSAL_TYPE.templateFix,
    title: 'Guard template collapse repair',
    objective: 'Stop the final guard from flattening shaped concierge replies back into a generic skeleton.',
    whyNotOthers: 'Planner/runtime repairs can still be erased if the final guard keeps collapsing the reply.'
  },
  [ROOT_CAUSE_TYPE.commandBoundaryMisfire]: {
    proposalType: PROPOSAL_TYPE.runtimeFix,
    title: 'Command-boundary collision repair',
    objective: 'Keep natural-language criteria/rewrite requests away from command-only handling paths.',
    whyNotOthers: 'Template tuning cannot fix collisions that happen before reply generation.'
  },
  [ROOT_CAUSE_TYPE.citySpecificityGap]: {
    proposalType: PROPOSAL_TYPE.specificityFix,
    title: 'City specificity grounding repair',
    objective: 'Increase city-specific grounding so city replies stop collapsing into generic guidance.',
    whyNotOthers: 'Continuity or template changes do not create city-specific evidence.'
  },
  [ROOT_CAUSE_TYPE.proceduralGuidanceGap]: {
    proposalType: PROPOSAL_TYPE.runtimeFix,
    title: 'Procedural guidance repair',
    objective: 'Increase concrete next-step guidance in broad and housing answers.',
    whyNotOthers: 'Observation-only work is no longer the main blocker; answer utility needs runtime repair.'
  },
  [ROOT_CAUSE_TYPE.retrievalBlocked]: {
    proposalType: PROPOSAL_TYPE.retrievalFix,
    title: 'Retrieval activation repair',
    objective: 'Reduce retrieval blocking for slices that need grounded candidates.',
    whyNotOthers: 'Knowledge selection cannot improve until retrieval is re-enabled for the affected slice.'
  }
});

function buildProposalKey(seed) {
  return `qpp_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 20)}`;
}

module.exports = {
  IMPROVEMENT_PLAN_VERSION,
  IMPROVEMENT_PLANNER_PROVENANCE,
  PROPOSAL_TYPE,
  PROPOSAL_RISK,
  PROPOSAL_PRIORITY,
  OBSERVATION_PROPOSAL_TYPES,
  TARGET_FILE_MAP,
  EXPECTED_IMPACT_MAP,
  PROPOSAL_TEMPLATE_BY_CAUSE,
  buildProposalKey
};
