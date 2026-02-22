'use strict';

const crypto = require('crypto');
const usersRepo = require('../../repos/firestore/usersRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const cityPackFeedbackRepo = require('../../repos/firestore/cityPackFeedbackRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

function resolveTraceId(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `trace-city-pack-feedback-${crypto.randomUUID()}`;
}

function extractFeedback(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { status: 'noop' };
  const match = raw.match(/^\s*City Pack Feedback:\s*(.+)$/i);
  if (!match) return { status: 'noop' };
  const content = match[1].trim();
  if (!content) return { status: 'usage' };
  const slotMatch = content.match(/^\s*\[([a-z_]+)\]\s*(.+)$/i);
  if (slotMatch) {
    return {
      status: 'received',
      slotKey: slotMatch[1].toLowerCase(),
      feedbackText: slotMatch[2].trim()
    };
  }
  return { status: 'received', slotKey: null, feedbackText: content };
}

async function declareCityPackFeedbackFromLine(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');
  const text = typeof payload.text === 'string' ? payload.text : '';
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : 'unknown';
  const traceId = resolveTraceId(payload.traceId || requestId);

  const parsed = extractFeedback(text);
  if (parsed.status === 'noop') return { ok: false, status: 'noop' };
  if (parsed.status === 'usage') return { ok: false, status: 'usage' };

  const user = await usersRepo.getUser(lineUserId);
  const regionCity = user && user.regionCity ? user.regionCity : null;
  const regionState = user && user.regionState ? user.regionState : null;
  const regionKey = user && user.regionKey ? user.regionKey : null;

  const feedback = await cityPackFeedbackRepo.createFeedback({
    status: 'queued',
    lineUserId,
    regionCity,
    regionState,
    regionKey,
    packClass: 'regional',
    language: 'ja',
    slotKey: parsed.slotKey,
    feedbackText: parsed.feedbackText,
    message: parsed.feedbackText,
    traceId,
    requestId
  });

  try {
    await appendAuditLog({
      actor: 'line',
      action: 'city_pack.feedback.received',
      entityType: 'city_pack_feedback',
      entityId: feedback.id,
      traceId,
      requestId,
      payloadSummary: {
        lineUserId,
        regionKey,
        slotKey: parsed.slotKey || null
      }
    });
  } catch (_err) {
    // best-effort only
  }

  try {
    await eventsRepo.createEvent({
      lineUserId,
      type: 'CITY_PACK_FEEDBACK_RECEIVED',
      ref: { feedbackId: feedback.id, traceId }
    });
  } catch (_err) {
    // best-effort only
  }

  return {
    ok: true,
    status: 'received',
    feedbackId: feedback.id,
    traceId
  };
}

module.exports = {
  declareCityPackFeedbackFromLine
};
