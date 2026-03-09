'use strict';

const FRAMEWORK_VERSION = 'v1';

const DIMENSIONS = Object.freeze([
  { key: 'factuality_grounding', label: 'Factuality/Grounding', weight: 0.12, hardGate: true },
  { key: 'source_authority_freshness', label: 'Source Authority/Freshness', weight: 0.08, hardGate: true },
  { key: 'procedural_utility', label: 'Procedural Utility', weight: 0.06, hardGate: false },
  { key: 'next_step_clarity', label: 'Next-step Clarity', weight: 0.05, hardGate: false },
  { key: 'conversation_continuity', label: 'Conversation Continuity', weight: 0.06, hardGate: false },
  { key: 'short_followup_understanding', label: 'Short Follow-up Understanding', weight: 0.06, hardGate: true },
  { key: 'clarification_quality', label: 'Clarification Quality', weight: 0.04, hardGate: false },
  { key: 'repetition_loop_avoidance', label: 'Repetition/Loop Avoidance', weight: 0.08, hardGate: true },
  { key: 'direct_answer_first', label: 'Direct Answer First', weight: 0.04, hardGate: false },
  { key: 'japanese_naturalness', label: 'Japanese Naturalness', weight: 0.04, hardGate: false },
  { key: 'japanese_service_quality', label: 'Japanese Service Quality', weight: 0.05, hardGate: true },
  { key: 'keigo_distance', label: 'Keigo/Distance', weight: 0.02, hardGate: false },
  { key: 'empathy', label: 'Empathy', weight: 0.03, hardGate: false },
  { key: 'cultural_habit_fit', label: 'Cultural/Habit Fit', weight: 0.03, hardGate: true },
  { key: 'line_native_fit', label: 'LINE Native Fit', weight: 0.04, hardGate: true },
  { key: 'action_policy_compliance', label: 'Action Policy Compliance', weight: 0.04, hardGate: true },
  { key: 'safety_compliance_privacy', label: 'Safety/Compliance/Privacy', weight: 0.08, hardGate: true },
  { key: 'memory_integrity', label: 'Memory Integrity', weight: 0.03, hardGate: true },
  { key: 'group_chat_privacy', label: 'Group Chat Privacy', weight: 0.03, hardGate: true },
  { key: 'minority_persona_robustness', label: 'Minority Persona Robustness', weight: 0.03, hardGate: true },
  { key: 'misunderstanding_recovery', label: 'Recovery from Misunderstanding', weight: 0.02, hardGate: false },
  { key: 'escalation_appropriateness', label: 'Escalation Appropriateness', weight: 0.02, hardGate: true },
  { key: 'operational_reliability', label: 'Operational Reliability', weight: 0.03, hardGate: true },
  { key: 'latency_surface_efficiency', label: 'Latency/Surface Efficiency', weight: 0.04, hardGate: false }
]);

const DIMENSION_WEIGHTS = Object.freeze(DIMENSIONS.reduce((acc, row) => {
  acc[row.key] = row.weight;
  return acc;
}, {}));

const SLICES = Object.freeze([
  { sliceKey: 'paid', critical: false },
  { sliceKey: 'free', critical: false },
  { sliceKey: 'admin', critical: false },
  { sliceKey: 'compat', critical: false },
  { sliceKey: 'short_followup', critical: true },
  { sliceKey: 'domain_continuation', critical: true },
  { sliceKey: 'group_chat', critical: true },
  { sliceKey: 'japanese_service_quality', critical: true },
  { sliceKey: 'minority_personas', critical: true },
  { sliceKey: 'cultural_slices', critical: true }
]);

const HARD_GATES = Object.freeze({
  blockOnAnySliceFail: true,
  blockOnCriticalSliceRegression: true,
  blockOnSafetyRegression: true,
  minHardDimensionScore: 0.82,
  minSoftDimensionScore: 0.7
});

const JUDGE_RELIABILITY_POLICY = Object.freeze({
  maxDisagreementRate: 0.15,
  maxSensitivityDrift: 0.10,
  humanReviewRequiredNearHardGate: true
});

const BENCHMARK_POLICY = Object.freeze({
  frozenRequired: true,
  reviewerApprovalRequired: true,
  excludeHighContaminationFromHardGate: true
});

const FRONTIER_THRESHOLDS = Object.freeze({
  qualityDeltaWarningBelow: 2,
  latencyRegressionWarnRate: 0.25,
  costRegressionBlockRate: 0.20,
  ackSlaViolationBlockRate: 0.01
});

module.exports = {
  FRAMEWORK_VERSION,
  DIMENSIONS,
  DIMENSION_WEIGHTS,
  SLICES,
  HARD_GATES,
  JUDGE_RELIABILITY_POLICY,
  BENCHMARK_POLICY,
  FRONTIER_THRESHOLDS
};
