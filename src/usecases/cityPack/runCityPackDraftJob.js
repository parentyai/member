'use strict';

const crypto = require('crypto');
const cityPackRequestsRepo = require('../../repos/firestore/cityPackRequestsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

function resolveTraceId(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `trace-city-pack-${crypto.randomUUID()}`;
}

function normalizeSourceUrls(values) {
  if (!Array.isArray(values)) return { valid: [], invalid: [] };
  const unique = Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
  const valid = [];
  const invalid = [];
  unique.forEach((value) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        invalid.push(value);
      } else {
        valid.push(parsed.toString());
      }
    } catch (_err) {
      invalid.push(value);
    }
  });
  return { valid, invalid };
}

function buildDraftName(request) {
  const city = request && request.regionCity ? String(request.regionCity) : '';
  const state = request && request.regionState ? String(request.regionState) : '';
  const parts = [city, state].map((item) => item.trim()).filter(Boolean);
  if (parts.length) return parts.join(', ');
  const regionKey = request && request.regionKey ? String(request.regionKey) : '';
  return regionKey || 'City Pack Draft';
}

function normalizeRequestClass(value) {
  const requestClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return requestClass === 'nationwide' ? 'nationwide' : 'regional';
}

function normalizeRequestedLanguage(value) {
  const language = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return language || 'ja';
}

function buildDefaultSlots() {
  return [{
    slotId: 'core',
    status: 'active',
    templateRefId: null,
    fallbackLinkRegistryId: null,
    fallbackCtaText: null,
    order: 1
  }];
}

function buildDefaultSlotContents() {
  const output = {};
  cityPacksRepo.FIXED_SLOT_KEYS.forEach((slotKey) => {
    output[slotKey] = {
      description: `${slotKey} guidance (draft)`,
      ctaText: '詳細を確認',
      linkRegistryId: 'pending_review',
      sourceRefs: []
    };
  });
  return output;
}

function buildDefaultTargetingRules(request) {
  if (!request || !request.regionKey) return [];
  return [{
    field: 'regionKey',
    op: 'eq',
    value: String(request.regionKey),
    effect: 'include'
  }];
}

async function runCityPackDraftJob(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
  if (!requestId) throw new Error('requestId required');

  const actor = payload.actor || 'city_pack_draft_job';
  const traceId = resolveTraceId(payload.traceId);
  const runId = typeof payload.runId === 'string' && payload.runId.trim() ? payload.runId.trim() : `cp_draft_${Date.now()}`;

  const request = await cityPackRequestsRepo.getRequest(requestId);
  if (!request) {
    await appendAuditLog({
      actor,
      action: 'city_pack.request.draft.failed',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId,
      requestId,
      payloadSummary: { reason: 'request_not_found' }
    });
    return { ok: false, reason: 'request_not_found', requestId, traceId };
  }

  const existingDrafts = Array.isArray(request.draftCityPackIds) ? request.draftCityPackIds : [];
  if (existingDrafts.length && ['drafted', 'approved', 'active'].includes(String(request.status || ''))) {
    return { ok: true, requestId, traceId, idempotent: true, draftCityPackIds: existingDrafts };
  }

  await cityPackRequestsRepo.updateRequest(requestId, {
    status: 'collecting',
    lastJobRunId: runId,
    experienceStage: 'collecting',
    error: null
  });

  const candidates = payload.sourceUrls || request.draftSourceCandidates || [];
  const normalized = normalizeSourceUrls(candidates);
  if (!normalized.valid.length) {
    await cityPackRequestsRepo.updateRequest(requestId, {
      status: 'needs_review',
      experienceStage: 'needs_review',
      error: 'source_candidates_missing'
    });
    await appendAuditLog({
      actor,
      action: 'city_pack.request.draft.blocked',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId,
      requestId,
      payloadSummary: { reason: 'source_candidates_missing' }
    });
    return { ok: false, reason: 'source_candidates_missing', requestId, traceId };
  }
  if (normalized.invalid.length) {
    await cityPackRequestsRepo.updateRequest(requestId, {
      status: 'needs_review',
      experienceStage: 'needs_review',
      error: 'source_candidates_invalid'
    });
    await appendAuditLog({
      actor,
      action: 'city_pack.request.draft.blocked',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId,
      requestId,
      payloadSummary: { reason: 'source_candidates_invalid', invalidCount: normalized.invalid.length }
    });
    return { ok: false, reason: 'source_candidates_invalid', requestId, traceId, invalidUrls: normalized.invalid };
  }

  const sourceRefIds = [];
  for (const url of normalized.valid) {
    const created = await sourceRefsRepo.createSourceRef({
      url,
      status: 'needs_review',
      riskLevel: 'medium',
      sourceType: 'official',
      requiredLevel: 'required'
    });
    sourceRefIds.push(created.id);
  }

  const cityPackName = buildDraftName(request);
  const requestClass = normalizeRequestClass(request && request.requestClass);
  const requestedLanguage = normalizeRequestedLanguage(request && request.requestedLanguage);
  const cityPack = await cityPacksRepo.createCityPack({
    name: cityPackName,
    status: 'draft',
    sourceRefs: sourceRefIds,
    allowedIntents: ['CITY_PACK'],
    rules: [],
    targetingRules: buildDefaultTargetingRules(request),
    slots: buildDefaultSlots(),
    slotContents: buildDefaultSlotContents(),
    slotSchemaVersion: 'v1_fixed_8_slots',
    description: request && request.regionKey ? `Draft for ${request.regionKey}` : 'Draft',
    requestId,
    templateRefs: [],
    packClass: requestClass,
    language: requestedLanguage,
    nationwidePolicy: requestClass === 'nationwide' ? cityPacksRepo.NATIONWIDE_POLICY_FEDERAL_ONLY : null
  });

  await cityPackRequestsRepo.updateRequest(requestId, {
    status: 'drafted',
    experienceStage: 'drafted',
    draftCityPackIds: [cityPack.id],
    draftTemplateIds: [],
    draftSourceRefIds: sourceRefIds,
    draftLinkRegistryIds: [],
    error: null
  });

  await appendAuditLog({
    actor,
    action: 'city_pack.request.drafted',
    entityType: 'city_pack_request',
    entityId: requestId,
    traceId,
    requestId,
    payloadSummary: {
      runId,
      sourceRefCount: sourceRefIds.length,
      cityPackId: cityPack.id,
      requestClass,
      requestedLanguage
    }
  });

  return {
    ok: true,
    requestId,
    traceId,
    status: 'drafted',
    draftCityPackIds: [cityPack.id],
    draftSourceRefIds: sourceRefIds
  };
}

module.exports = {
  runCityPackDraftJob
};
