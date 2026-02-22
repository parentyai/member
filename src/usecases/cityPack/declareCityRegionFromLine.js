'use strict';

const crypto = require('crypto');
const { serverTimestamp } = require('../../infra/firestore');
const usersRepo = require('../../repos/firestore/usersRepo');
const cityPackRequestsRepo = require('../../repos/firestore/cityPackRequestsRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { parseRegionInput } = require('../../domain/regionNormalization');

function resolveTraceId(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `trace-city-pack-${crypto.randomUUID()}`;
}

async function declareCityRegionFromLine(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : 'unknown';
  const traceId = resolveTraceId(payload.traceId || requestId);

  if (!text) return { ok: false, status: 'noop' };

  const user = await usersRepo.getUser(lineUserId);
  if (user && user.regionKey) {
    return { ok: true, status: 'already_set', regionKey: user.regionKey };
  }

  const parsed = parseRegionInput(text);
  if (!parsed.ok) {
    return { ok: false, status: 'prompt_required', reason: parsed.reason || 'invalid_format' };
  }

  const regionCity = parsed.city;
  const regionState = parsed.state;
  const regionKey = parsed.regionKey;

  await usersRepo.updateUser(lineUserId, {
    regionCity,
    regionState,
    regionKey,
    regionDeclaredAt: serverTimestamp(),
    regionDeclaredBy: 'user'
  });

  const request = await cityPackRequestsRepo.createRequest({
    status: 'queued',
    lineUserId,
    regionCity,
    regionState,
    regionKey,
    requestClass: 'regional',
    requestedLanguage: 'ja',
    requestedAt: new Date().toISOString(),
    traceId,
    experienceStage: 'queued',
    draftCityPackIds: [],
    draftTemplateIds: [],
    draftSourceRefIds: [],
    draftLinkRegistryIds: [],
    lastReviewAt: null
  });

  try {
    await appendAuditLog({
      actor: 'line',
      action: 'city_pack.request.created',
      entityType: 'city_pack_request',
      entityId: request.id,
      traceId,
      requestId,
      payloadSummary: {
        lineUserId,
        regionKey
      }
    });
  } catch (_err) {
    // best-effort only
  }

  try {
    await eventsRepo.createEvent({
      lineUserId,
      type: 'CITY_REGION_DECLARED',
      ref: { regionKey, regionCity, regionState, traceId }
    });
    await eventsRepo.createEvent({
      lineUserId,
      type: 'CITY_PACK_REQUESTED',
      ref: { requestId: request.id, traceId }
    });
  } catch (_err) {
    // best-effort only
  }

  return {
    ok: true,
    status: 'declared',
    requestId: request.id,
    traceId,
    regionCity,
    regionState,
    regionKey
  };
}

module.exports = {
  declareCityRegionFromLine
};
