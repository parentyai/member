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
  const updateSourceRef = deps && deps.updateSourceRef ? deps.updateSourceRef : sourceRefsRepo.updateSourceRef;
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

  const packClass = cityPack.packClass || 'regional';
  const language = cityPack.language || 'ja';
  const nationwidePolicy = cityPack.nationwidePolicy || null;
  const validation = await validateCityPackSources({
    sourceRefs,
    packClass,
    language,
    nationwidePolicy,
    now: payload.now
  });
  if (!validation.ok) {
    const policyInvalidSourceRefs = Array.isArray(validation.policyInvalidSourceRefs) ? validation.policyInvalidSourceRefs : [];
    for (const failure of policyInvalidSourceRefs) {
      if (!failure || !failure.sourceRefId) continue;
      await updateSourceRef(failure.sourceRefId, {
        status: 'needs_review',
        lastResult: 'policy_blocked'
      });
    }
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
        invalidSourceRefs: validation.invalidSourceRefs,
        policyGuardViolations: Array.isArray(validation.policyGuardViolations) ? validation.policyGuardViolations : [],
        packClass,
        language,
        nationwidePolicy
      }
    });
    return {
      ok: false,
      reason: 'source_not_ready',
      cityPackId,
      blockedReasonCategory: validation.blockedReasonCategory,
      invalidSourceRefs: validation.invalidSourceRefs,
      policyGuardViolations: Array.isArray(validation.policyGuardViolations) ? validation.policyGuardViolations : [],
      packClass,
      language,
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
      allowedIntents: ['CITY_PACK'],
      packClass,
      language,
      nationwidePolicy
    }
  });

  return {
    ok: true,
    cityPackId,
    status: 'active',
    sourceRefCount: sourceRefs.length,
    packClass,
    language,
    traceId
  };
}

module.exports = {
  activateCityPack
};
