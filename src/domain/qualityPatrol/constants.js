'use strict';

const SIGNAL_STATUS = Object.freeze({
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable'
});

const RESULT_STATUS = Object.freeze({
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  BLOCKED: 'blocked'
});

const SIGNAL_THRESHOLDS = Object.freeze({
  naturalness: { warnBelow: 0.7, failBelow: 0.45 },
  continuity: { warnBelow: 0.7, failBelow: 0.45 },
  specificity: { warnBelow: 0.7, failBelow: 0.45 },
  proceduralUtility: { warnBelow: 0.7, failBelow: 0.45 },
  knowledgeUse: { warnBelow: 0.7, failBelow: 0.45 },
  fallbackRepetition: { warnAbove: 0.4, failAbove: 0.65 }
});

const EVALUATOR_BLOCKER_CATALOG = Object.freeze({
  insufficient_context_for_followup_judgement: {
    severity: 'medium',
    message: 'follow-up continuity judgement needs prior context evidence',
    source: 'conversation_quality_evaluator'
  },
  insufficient_knowledge_signals: {
    severity: 'low',
    message: 'knowledge-use judgement needs candidate availability or reuse signals',
    source: 'conversation_quality_evaluator'
  },
  insufficient_trace_evidence: {
    severity: 'low',
    message: 'trace completeness is too low for stronger confidence',
    source: 'conversation_quality_evaluator'
  }
});

const GENERIC_TEMPLATE_TOKENS = Object.freeze([
  'generic',
  'fallback',
  'default'
]);

const GENERIC_FALLBACK_PATTERNS = Object.freeze([
  /まずは次の一手です/u,
  /まずは次の一手/u,
  /以下の観点で/u,
  /必要なら/u,
  /一般的には/u
]);

const ABSTRACT_EXPLANATION_PATTERNS = Object.freeze([
  /一般的には/u,
  /ケースによります/u,
  /状況によって/u,
  /様々です/u,
  /一概には/u
]);

const FOLLOWUP_RESET_PATTERNS = Object.freeze([
  /改めて状況を教えて/u,
  /もう少し詳しく/u,
  /一般論としては/u,
  /まずは状況整理/u
]);

const ACTIONABLE_PATTERNS = Object.freeze([
  /まず/u,
  /次に/u,
  /確認/u,
  /連絡/u,
  /申請/u,
  /予約/u,
  /比較/u,
  /相談/u,
  /手順/u,
  /準備/u,
  /進め/u
]);

const ORDER_MARKER_PATTERNS = Object.freeze([
  /(^|\n)\s*[0-9]+\./u,
  /(^|\n)\s*[0-9]+\)/u,
  /①|②|③/u,
  /・/u
]);

const COLD_TONE_PATTERNS = Object.freeze([
  /できません。?$/u,
  /対応不可/u,
  /無理です/u
]);

const SOFT_TONE_PATTERNS = Object.freeze([
  /よければ/u,
  /必要なら/u,
  /一緒に/u,
  /まず/u
]);

const CITY_KEYWORDS = Object.freeze([
  'city',
  '駅',
  'エリア',
  '街',
  '地域',
  '区'
]);

const HOUSING_KEYWORDS = Object.freeze([
  '住',
  '家賃',
  '物件',
  '内見',
  '契約',
  '引っ越し'
]);

const SCHOOL_KEYWORDS = Object.freeze([
  'school',
  'district',
  'enrollment',
  'registration',
  'immunization',
  'vaccin',
  '学校',
  '学区',
  '編入',
  '転校',
  '予防接種',
  '接種'
]);

const KNOWLEDGE_CANDIDATE_KINDS = Object.freeze([
  'grounded_candidate',
  'city_grounded_candidate',
  'city_pack_backed_candidate',
  'saved_faq_candidate'
]);

module.exports = {
  SIGNAL_STATUS,
  RESULT_STATUS,
  SIGNAL_THRESHOLDS,
  EVALUATOR_BLOCKER_CATALOG,
  GENERIC_TEMPLATE_TOKENS,
  GENERIC_FALLBACK_PATTERNS,
  ABSTRACT_EXPLANATION_PATTERNS,
  FOLLOWUP_RESET_PATTERNS,
  ACTIONABLE_PATTERNS,
  ORDER_MARKER_PATTERNS,
  COLD_TONE_PATTERNS,
  SOFT_TONE_PATTERNS,
  CITY_KEYWORDS,
  HOUSING_KEYWORDS,
  SCHOOL_KEYWORDS,
  KNOWLEDGE_CANDIDATE_KINDS
};
