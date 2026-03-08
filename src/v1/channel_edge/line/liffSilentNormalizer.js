'use strict';

const crypto = require('crypto');

function normalizeLiffSilentPayload(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim()
    ? payload.traceId.trim()
    : `liff_silent_${crypto.randomUUID()}`;
  if (!lineUserId || !text) {
    return {
      ok: false,
      reason: 'lineUserId_and_text_required',
      syntheticEvent: null,
      traceId
    };
  }
  const now = Date.now();
  return {
    ok: true,
    reason: 'normalized',
    traceId,
    syntheticEvent: {
      type: 'message',
      mode: 'active',
      timestamp: now,
      webhookEventId: `liff_synthetic_${crypto.randomUUID()}`,
      source: {
        type: payload.sourceType || 'user',
        userId: lineUserId
      },
      message: {
        id: `liff_msg_${now}`,
        type: 'text',
        text
      },
      _synthetic: true,
      _origin: 'liff_silent_path'
    }
  };
}

module.exports = {
  normalizeLiffSilentPayload
};
