'use strict';

const DEFAULT_MAX_LENGTH = 280;

const MASK_PATTERNS = Object.freeze([
  { label: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: '[email]' },
  { label: 'url', pattern: /(?:https?:\/\/|www\.)\S+/gi, replacement: '[url]' },
  { label: 'phone', pattern: /(?:\+?\d[\d()]*[\s\-][\d\s\-()]{6,}\d)/g, replacement: '[phone]' },
  { label: 'postal', pattern: /\b\d{3}-?\d{4}\b/g, replacement: '[postal]' },
  { label: 'number', pattern: /\b\d{6,}\b/g, replacement: '[number]' }
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function applyMask(text) {
  let next = text;
  const replacements = [];
  MASK_PATTERNS.forEach(({ label, pattern, replacement }) => {
    let count = 0;
    next = next.replace(pattern, () => {
      count += 1;
      return replacement;
    });
    if (count > 0) replacements.push({ label, count });
  });
  return { text: next, replacements };
}

function resolveMaxLength(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_LENGTH;
  return Math.max(32, Math.min(Math.floor(numeric), 2000));
}

function maskConversationReviewText(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const source = normalizeText(payload.text);
  const maxLength = resolveMaxLength(payload.maxLength);
  if (!source) {
    return {
      text: null,
      available: false,
      truncated: false,
      originalLength: 0,
      storedLength: 0,
      replacements: []
    };
  }

  const masked = applyMask(source);
  const truncated = masked.text.length > maxLength;
  const output = truncated
    ? `${masked.text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : masked.text;

  return {
    text: output || null,
    available: Boolean(output),
    truncated,
    originalLength: source.length,
    storedLength: output.length,
    replacements: masked.replacements
  };
}

module.exports = {
  DEFAULT_MAX_LENGTH,
  MASK_PATTERNS,
  maskConversationReviewText
};
