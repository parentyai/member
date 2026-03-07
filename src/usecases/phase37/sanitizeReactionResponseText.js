'use strict';

const MAX_RESPONSE_TEXT_LENGTH = 2000;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s\-()]{8,}\d)/;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_RESPONSE_TEXT_LENGTH);
}

function resolveStorageEnabled() {
  const raw = String(process.env.ENABLE_REACTION_RESPONSE_TEXT_STORE_V1 || '').trim();
  if (!raw) return true;
  return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
}

function sanitizeReactionResponseText(value) {
  const text = normalizeText(value);
  if (!text) {
    return { value: null, stored: false, reason: 'empty', length: 0 };
  }
  if (!resolveStorageEnabled()) {
    return { value: null, stored: false, reason: 'feature_flag_off', length: text.length };
  }
  if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) {
    return { value: null, stored: false, reason: 'pii_pattern_detected', length: text.length };
  }
  return { value: text, stored: true, reason: null, length: text.length };
}

module.exports = {
  MAX_RESPONSE_TEXT_LENGTH,
  sanitizeReactionResponseText
};

