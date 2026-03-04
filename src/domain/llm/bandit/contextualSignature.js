'use strict';

const crypto = require('crypto');

const CONTEXT_SIGNATURE_VERSION = 'ctxsig_v1';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeBoolean(value) {
  return value === true ? '1' : '0';
}

function buildContextSignature(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const parts = [
    CONTEXT_SIGNATURE_VERSION,
    normalizeText(payload.featureVersion, 'bandit_ctx_v1'),
    normalizeText(payload.journeyPhase, 'pre'),
    normalizeText(payload.tier, 'free'),
    normalizeText(payload.mode, 'A'),
    normalizeText(payload.topic, 'general'),
    normalizeText(payload.riskBucket, 'low'),
    normalizeText(payload.evidenceNeed, 'none'),
    normalizeText(payload.intentConfidenceBucket, 'low'),
    normalizeText(payload.contextConfidenceBucket, 'low'),
    normalizeText(payload.taskLoadBucket, 'none'),
    normalizeText(payload.lengthBucket, 'short'),
    normalizeText(payload.timingBucket, 'daytime'),
    normalizeBoolean(payload.questionFlag),
    normalizeBoolean(payload.blockedTaskPresent),
    normalizeBoolean(payload.dueSoonTaskPresent)
  ];
  const canonical = parts.join('|').toLowerCase();
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 20);
  return `${CONTEXT_SIGNATURE_VERSION}_${hash}`;
}

module.exports = {
  CONTEXT_SIGNATURE_VERSION,
  buildContextSignature
};
