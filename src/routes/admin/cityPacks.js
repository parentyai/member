'use strict';

const crypto = require('crypto');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { activateCityPack } = require('../../usecases/cityPack/activateCityPack');
const { composeCityAndNationwidePacks } = require('../../usecases/nationwidePack/composeCityAndNationwidePacks');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function parseCityPackAction(pathname) {
  const activateMatch = pathname.match(/^\/api\/admin\/city-packs\/([^/]+)\/(activate|retire|structure)$/);
  if (!activateMatch) return null;
  return {
    cityPackId: decodeURIComponent(activateMatch[1]),
    action: activateMatch[2]
  };
}

function parseCityPackDetail(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-packs\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function parseCityPackExport(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-packs\/([^/]+)\/export$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function parseImportPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-packs\/import\/(dry-run|apply)$/);
  if (!match) return null;
  return match[1];
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())));
}

function normalizeImportTemplate(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const template = payload.template && typeof payload.template === 'object' && !Array.isArray(payload.template)
    ? payload.template
    : null;
  if (!template) throw new Error('template required');
  const name = typeof template.name === 'string' && template.name.trim() ? template.name.trim() : '';
  if (!name) throw new Error('template.name required');
  const sourceRefs = normalizeStringArray(template.sourceRefs);
  if (!sourceRefs.length) throw new Error('template.sourceRefs required');
  const packClass = cityPacksRepo.normalizePackClass(template.packClass);
  const language = cityPacksRepo.normalizeLanguage(template.language);
  const nationwidePolicy = cityPacksRepo.normalizeNationwidePolicy(packClass, template.nationwidePolicy);

  return {
    name,
    description: typeof template.description === 'string' ? template.description.trim() : '',
    sourceRefs,
    validUntil: template.validUntil || null,
    allowedIntents: Array.isArray(template.allowedIntents) ? template.allowedIntents : ['CITY_PACK'],
    rules: Array.isArray(template.rules) ? template.rules : [],
    targetingRules: Array.isArray(template.targetingRules) ? template.targetingRules : [],
    slots: Array.isArray(template.slots) ? template.slots : [],
    metadata: template.metadata && typeof template.metadata === 'object' ? template.metadata : {},
    templateRefs: normalizeStringArray(template.templateRefs),
    basePackId: cityPacksRepo.normalizeBasePackId(template.basePackId),
    overrides: cityPacksRepo.normalizeOverrides(template.overrides),
    packClass,
    language,
    nationwidePolicy,
    status: 'draft'
  };
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  const fields = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
  return `{${fields.join(',')}}`;
}

function computeImportPlanHash(templatePayload) {
  return crypto.createHash('sha256').update(stableSerialize(templatePayload)).digest('hex');
}

function importConfirmTokenData(planHash) {
  return {
    planHash: String(planHash || ''),
    action: 'city_pack_import_apply'
  };
}

async function handleCreateCityPack(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const normalizedPackClass = cityPacksRepo.normalizePackClass(payload.packClass);
  const normalizedLanguage = cityPacksRepo.normalizeLanguage(payload.language);
  const normalizedNationwidePolicy = cityPacksRepo.normalizeNationwidePolicy(normalizedPackClass, payload.nationwidePolicy);
  const created = await cityPacksRepo.createCityPack({
    id: payload.id,
    name: payload.name,
    description: payload.description,
    sourceRefs: payload.sourceRefs,
    validUntil: payload.validUntil,
    allowedIntents: payload.allowedIntents,
    status: payload.status,
    rules: payload.rules,
    targetingRules: payload.targetingRules,
    slots: payload.slots,
    metadata: payload.metadata,
    packClass: payload.packClass,
    language: payload.language,
    nationwidePolicy: payload.nationwidePolicy
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.create',
    entityType: 'city_pack',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      name: payload.name || null,
      sourceRefCount: Array.isArray(payload.sourceRefs) ? payload.sourceRefs.length : 0,
      validUntil: payload.validUntil || null,
      packClass: normalizedPackClass,
      language: normalizedLanguage,
      nationwidePolicy: normalizedNationwidePolicy
    }
  });
  writeJson(res, 201, {
    ok: true,
    cityPackId: created.id,
    traceId: context.traceId
  });
}

async function handleListCityPacks(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const packClass = (url.searchParams.get('packClass') || '').trim() || null;
  const language = (url.searchParams.get('language') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const items = await cityPacksRepo.listCityPacks({ status, packClass, language, limit });
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items
  });
}

async function handleCityPackComposition(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const regionKey = (url.searchParams.get('regionKey') || '').trim() || null;
  const language = (url.searchParams.get('language') || '').trim().toLowerCase() || 'ja';
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const payload = await composeCityAndNationwidePacks({ regionKey, language, limit });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.composition.view',
    entityType: 'city_pack',
    entityId: 'composition',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      regionKey,
      language,
      limit,
      total: payload && payload.summary ? payload.summary.total : 0,
      regional: payload && payload.summary ? payload.summary.regional : 0,
      nationwide: payload && payload.summary ? payload.summary.nationwide : 0
    }
  });
  writeJson(res, 200, Object.assign({ traceId: context.traceId }, payload));
}

async function handleGetCityPack(req, res, context, cityPackId) {
  const cityPack = await cityPacksRepo.getCityPack(cityPackId);
  if (!cityPack) {
    writeJson(res, 404, { ok: false, error: 'city pack not found' });
    return;
  }
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    item: cityPack
  });
}

async function handleExportCityPack(req, res, context, cityPackId) {
  const cityPack = await cityPacksRepo.getCityPack(cityPackId);
  if (!cityPack) {
    writeJson(res, 404, { ok: false, error: 'city pack not found' });
    return;
  }
  const template = {
    schemaVersion: 'city_pack_template_v1',
    name: cityPack.name || '',
    description: cityPack.description || '',
    sourceRefs: Array.isArray(cityPack.sourceRefs) ? cityPack.sourceRefs : [],
    validUntil: cityPack.validUntil || null,
    allowedIntents: Array.isArray(cityPack.allowedIntents) ? cityPack.allowedIntents : ['CITY_PACK'],
    rules: Array.isArray(cityPack.rules) ? cityPack.rules : [],
    targetingRules: Array.isArray(cityPack.targetingRules) ? cityPack.targetingRules : [],
    slots: Array.isArray(cityPack.slots) ? cityPack.slots : [],
    metadata: cityPack.metadata && typeof cityPack.metadata === 'object' ? cityPack.metadata : {},
    templateRefs: Array.isArray(cityPack.templateRefs) ? cityPack.templateRefs : [],
    basePackId: cityPack.basePackId || null,
    overrides: cityPack.overrides || null,
    packClass: cityPack.packClass || 'regional',
    language: cityPack.language || 'ja',
    nationwidePolicy: cityPack.nationwidePolicy || null
  };
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.template.export',
    entityType: 'city_pack',
    entityId: cityPackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      sourceRefCount: template.sourceRefs.length,
      slotCount: template.slots.length
    }
  });
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    cityPackId,
    exportedAt: new Date().toISOString(),
    template
  });
}

async function handleImportCityPackDryRun(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const normalized = normalizeImportTemplate(payload);
  const planHash = computeImportPlanHash(normalized);
  const confirmToken = createConfirmToken(importConfirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.template.import_dry_run',
    entityType: 'city_pack_template',
    entityId: planHash,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      sourceRefCount: normalized.sourceRefs.length,
      slotCount: normalized.slots.length,
      targetingRuleCount: normalized.targetingRules.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    planHash,
    confirmToken,
    normalizedTemplate: normalized
  });
}

async function handleImportCityPackApply(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const planHash = typeof payload.planHash === 'string' ? payload.planHash.trim() : '';
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken.trim() : '';
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required' });
    return;
  }
  const normalized = normalizeImportTemplate(payload);
  const expectedPlanHash = computeImportPlanHash(normalized);
  if (planHash !== expectedPlanHash) {
    writeJson(res, 409, { ok: false, error: 'plan hash mismatch', expectedPlanHash });
    return;
  }
  const confirmOk = verifyConfirmToken(confirmToken, importConfirmTokenData(planHash), { now: new Date() });
  if (!confirmOk) {
    writeJson(res, 409, { ok: false, error: 'invalid confirm token' });
    return;
  }
  const created = await cityPacksRepo.createCityPack(normalized);
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.template.import_apply',
    entityType: 'city_pack',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      planHash,
      sourceRefCount: normalized.sourceRefs.length,
      slotCount: normalized.slots.length
    }
  });
  writeJson(res, 201, {
    ok: true,
    traceId: context.traceId,
    cityPackId: created.id,
    planHash
  });
}

async function handleActivateCityPack(req, res, context, cityPackId) {
  const result = await activateCityPack({
    cityPackId,
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId
  });
  if (!result.ok) {
    writeJson(res, 409, result);
    return;
  }
  writeJson(res, 200, result);
}

async function handleRetireCityPack(req, res, context, cityPackId) {
  await cityPacksRepo.updateCityPack(cityPackId, { status: 'retired' });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.retire',
    entityType: 'city_pack',
    entityId: cityPackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: 'retired'
    }
  });
  writeJson(res, 200, {
    ok: true,
    cityPackId,
    status: 'retired',
    traceId: context.traceId
  });
}

async function handleUpdateCityPackStructure(req, res, bodyText, context, cityPackId) {
  const cityPack = await cityPacksRepo.getCityPack(cityPackId);
  if (!cityPack) {
    writeJson(res, 404, { ok: false, error: 'city pack not found' });
    return;
  }
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const structurePatch = cityPacksRepo.normalizeCityPackStructurePatch(payload);
  if (structurePatch.basePackId) {
    if (structurePatch.basePackId === cityPackId) {
      writeJson(res, 409, { ok: false, error: 'base_pack_self_reference' });
      return;
    }
    const basePack = await cityPacksRepo.getCityPack(structurePatch.basePackId);
    const baseValidation = cityPacksRepo.validateBasePackDepth(basePack);
    if (!baseValidation.ok) {
      writeJson(res, 409, { ok: false, error: baseValidation.reason });
      return;
    }
  }
  await cityPacksRepo.updateCityPack(cityPackId, structurePatch);
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.structure.update',
    entityType: 'city_pack',
    entityId: cityPackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      targetingRuleCount: structurePatch.targetingRules.length,
      slotCount: structurePatch.slots.length,
      basePackId: structurePatch.basePackId || null
    }
  });
  writeJson(res, 200, {
    ok: true,
    cityPackId,
    traceId: context.traceId,
    targetingRuleCount: structurePatch.targetingRules.length,
    slotCount: structurePatch.slots.length,
    basePackId: structurePatch.basePackId || null
  });
}

async function handleCityPacks(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-packs/composition') {
      await handleCityPackComposition(req, res, context);
      return;
    }
    if (req.method === 'GET' && pathname === '/api/admin/city-packs') {
      await handleListCityPacks(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const exportId = parseCityPackExport(pathname);
      if (exportId) {
        await handleExportCityPack(req, res, context, exportId);
        return;
      }
      const detailId = parseCityPackDetail(pathname);
      if (detailId) {
        await handleGetCityPack(req, res, context, detailId);
        return;
      }
    }

    if (req.method === 'POST' && pathname === '/api/admin/city-packs') {
      await handleCreateCityPack(req, res, bodyText, context);
      return;
    }

    if (req.method === 'POST') {
      const importAction = parseImportPath(pathname);
      if (importAction === 'dry-run') {
        await handleImportCityPackDryRun(req, res, bodyText, context);
        return;
      }
      if (importAction === 'apply') {
        await handleImportCityPackApply(req, res, bodyText, context);
        return;
      }
    }

    if (req.method === 'POST') {
      const parsed = parseCityPackAction(pathname);
      if (parsed && parsed.action === 'activate') {
        await handleActivateCityPack(req, res, context, parsed.cityPackId);
        return;
      }
      if (parsed && parsed.action === 'retire') {
        await handleRetireCityPack(req, res, context, parsed.cityPackId);
        return;
      }
      if (parsed && parsed.action === 'structure') {
        await handleUpdateCityPackStructure(req, res, bodyText, context, parsed.cityPackId);
        return;
      }
    }

    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_packs', err, context);
    const message = err && err.message ? err.message : 'error';
    writeJson(res, 500, { ok: false, error: message });
  }
}

module.exports = {
  handleCityPacks
};
