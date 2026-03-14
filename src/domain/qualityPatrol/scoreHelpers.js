'use strict';

const {
  SIGNAL_STATUS,
  EVALUATOR_BLOCKER_CATALOG
} = require('./constants');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase();
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Math.round(numeric * 10000) / 10000;
}

function createSupportingSignal(code, direction, message, extras) {
  return Object.assign({
    code,
    direction,
    message,
    source: 'conversation_quality_evaluator'
  }, extras && typeof extras === 'object' ? extras : {});
}

function createEvaluatorBlocker(code, extras) {
  const base = EVALUATOR_BLOCKER_CATALOG[code];
  if (!base) return null;
  return Object.assign({
    code,
    severity: base.severity,
    message: base.message,
    source: base.source
  }, extras && typeof extras === 'object' ? extras : {});
}

function uniqueByCode(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows.filter(Boolean).filter((item, index) =>
    rows.findIndex((other) => other && other.code === item.code) === index
  );
}

function buildQualityStatus(value, threshold) {
  if (value <= threshold.failBelow) return SIGNAL_STATUS.FAIL;
  if (value <= threshold.warnBelow) return SIGNAL_STATUS.WARN;
  return SIGNAL_STATUS.PASS;
}

function buildRiskStatus(value, threshold) {
  if (value >= threshold.failAbove) return SIGNAL_STATUS.FAIL;
  if (value >= threshold.warnAbove) return SIGNAL_STATUS.WARN;
  return SIGNAL_STATUS.PASS;
}

function extractMeaningfulTokens(text) {
  const source = normalizeText(text);
  if (!source) return [];
  const raw = source.match(/[A-Za-z]{2,}|[0-9]{2,}|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}/gu) || [];
  return Array.from(new Set(raw.map((value) => normalizeToken(value)).filter(Boolean)));
}

function tokenOverlap(leftText, rightText) {
  const left = extractMeaningfulTokens(leftText);
  const right = extractMeaningfulTokens(rightText);
  if (!left.length || !right.length) {
    return {
      ratio: 0,
      overlap: []
    };
  }
  const rightSet = new Set(right);
  const overlap = left.filter((token) => rightSet.has(token));
  return {
    ratio: overlap.length / Math.max(1, Math.min(left.length, right.length)),
    overlap
  };
}

function countPatternMatches(text, patterns) {
  const source = normalizeText(text);
  if (!source) return 0;
  return (Array.isArray(patterns) ? patterns : []).reduce((count, pattern) => {
    if (!(pattern instanceof RegExp)) return count;
    const matches = source.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function includesTemplateToken(value, tokens) {
  const normalized = normalizeToken(value);
  return Array.isArray(tokens) && tokens.some((token) => normalized.includes(String(token || '').toLowerCase()));
}

function hasObservationBlocker(blockers, code) {
  return Array.isArray(blockers) && blockers.some((item) => item && item.code === code);
}

function mergeSourceCollections() {
  return Array.from(new Set([].concat(...Array.from(arguments)).filter(Boolean)));
}

module.exports = {
  SIGNAL_STATUS,
  normalizeText,
  normalizeToken,
  clamp01,
  createSupportingSignal,
  createEvaluatorBlocker,
  uniqueByCode,
  buildQualityStatus,
  buildRiskStatus,
  extractMeaningfulTokens,
  tokenOverlap,
  countPatternMatches,
  includesTemplateToken,
  hasObservationBlocker,
  mergeSourceCollections
};
