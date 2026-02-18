'use strict';

const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { validateCityPackSources } = require('./validateCityPackSources');

async function activateCityPack(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const cityPackId = typeof payload.cityPackId === 'string' ? payload.cityPackId.trim() : '';
  if (!cityPackId) throw new Error('cityPackId required');

  const actor = payload.actor || 'unknown';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;

  const getCityPack = deps && deps.getCityPack ? deps.getCityPack : cityPacksRepo.getCityPack;
  const updateCityPack = deps && deps.updateCityPack ? deps.updateCityPack : cityPacksRepo.updateCityPack;
  const linkCityPack = deps && deps.linkCityPack ? deps.linkCityPack : sourceRefsRepo.linkCityPack;
  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const cityPack = await getCityPack(cityPackId);
  if (!cityPack) {
    await audit({
      actor,
      action: 'city_pack.activate.failed',
      entityType: 'city_pack',
      entityId: cityPackId,
      traceId,
      requestId,
      payloadSummary: { reason: 'city_pack_not_found' }
    });
    return { ok: false, reason: 'city_pack_not_found', cityPackId, traceId };
  }

  const sourceRefs = Array.isArray(cityPack.sourceRefs) ? cityPack.sourceRefs : [];
  if (!sourceRefs.length) {
    await audit({
      actor,
      action: 'city_pack.activate.blocked',
      entityType: 'city_pack',
      entityId: cityPackId,
      traceId,
      requestId,
      payloadSummary: { reason: 'source_refs_required', cityPackId }
    });
    return { ok: false, reason: 'source_refs_required', cityPackId, traceId };
  }

  const validation = await validateCityPackSources({ sourceRefs, now: payload.now });
  if (!validation.ok) {
    await audit({
      actor,
      action: 'city_pack.activate.blocked',
      entityType: 'city_pack',
      entityId: cityPackId,
      traceId,
      requestId,
      payloadSummary: {
        reason: 'source_not_ready',
        blockedReasonCategory: validation.blockedReasonCategory,
        invalidSourceRefs: validation.invalidSourceRefs
      }
    });
    return {
      ok: false,
      reason: 'source_not_ready',
      cityPackId,
      blockedReasonCategory: validation.blockedReasonCategory,
      invalidSourceRefs: validation.invalidSourceRefs,
      traceId
    };
  }

  await updateCityPack(cityPackId, {
    status: 'active',
    allowedIntents: ['CITY_PACK']
  });

  for (const sourceRefId of sourceRefs) {
    await linkCityPack(sourceRefId, cityPackId);
  }

  await audit({
    actor,
    action: 'city_pack.activate',
    entityType: 'city_pack',
    entityId: cityPackId,
    traceId,
    requestId,
    payloadSummary: {
      status: 'active',
      sourceRefCount: sourceRefs.length,
      allowedIntents: ['CITY_PACK']
    }
  });

  return {
    ok: true,
    cityPackId,
    status: 'active',
    sourceRefCount: sourceRefs.length,
    traceId
  };
}

module.exports = {
  activateCityPack
};
