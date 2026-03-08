'use strict';

const ALLOWED_CLASSES = new Set(['lookup', 'draft', 'assist', 'human_only']);

function resolveActionClass(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!ALLOWED_CLASSES.has(normalized)) return 'lookup';
  return normalized;
}

module.exports = {
  resolveActionClass,
  ALLOWED_CLASSES
};
