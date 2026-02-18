'use strict';

const FAILURE_CODES = Object.freeze({
  GUARD_BLOCK_KILL_SWITCH: 'GUARD_BLOCK_KILL_SWITCH',
  GUARD_BLOCK_WARN_LINK: 'GUARD_BLOCK_WARN_LINK',
  INVALID_CTA: 'INVALID_CTA',
  MISSING_LINK_REGISTRY_ID: 'MISSING_LINK_REGISTRY_ID',
  DIRECT_URL_FORBIDDEN: 'DIRECT_URL_FORBIDDEN',
  DELIVERY_WRITE_FAIL: 'DELIVERY_WRITE_FAIL',
  LINE_API_FAIL: 'LINE_API_FAIL',
  SOURCE_EXPIRED: 'SOURCE_EXPIRED',
  SOURCE_DEAD: 'SOURCE_DEAD',
  SOURCE_BLOCKED: 'SOURCE_BLOCKED',
  UNEXPECTED_EXCEPTION: 'UNEXPECTED_EXCEPTION'
});

function normalizeMessage(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err && typeof err.message === 'string') return err.message;
  return '';
}

function mapFailureCode(err) {
  const message = normalizeMessage(err);
  if (!message) return FAILURE_CODES.UNEXPECTED_EXCEPTION;
  const lower = message.toLowerCase();
  if (lower.includes('kill switch')) return FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH;
  if (lower.includes('link health warn')) return FAILURE_CODES.GUARD_BLOCK_WARN_LINK;
  if (lower.includes('cta')) return FAILURE_CODES.INVALID_CTA;
  if (lower.includes('linkregistryid required') || lower.includes('link registry entry not found') || lower.includes('link id required')) {
    return FAILURE_CODES.MISSING_LINK_REGISTRY_ID;
  }
  if (lower.includes('direct url is forbidden')) return FAILURE_CODES.DIRECT_URL_FORBIDDEN;
  if (lower.includes('line api error')) return FAILURE_CODES.LINE_API_FAIL;
  if (lower.includes('source_expired') || lower.includes('source expired')) return FAILURE_CODES.SOURCE_EXPIRED;
  if (lower.includes('source_dead') || lower.includes('source dead')) return FAILURE_CODES.SOURCE_DEAD;
  if (lower.includes('source_blocked') || lower.includes('source blocked')) return FAILURE_CODES.SOURCE_BLOCKED;
  if (lower.includes('delivery')) return FAILURE_CODES.DELIVERY_WRITE_FAIL;
  return FAILURE_CODES.UNEXPECTED_EXCEPTION;
}

module.exports = {
  FAILURE_CODES,
  mapFailureCode
};
