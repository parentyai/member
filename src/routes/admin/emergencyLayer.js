'use strict';

const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const emergencyRulesRepo = require('../../repos/firestore/emergencyRulesRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  listEmergencyProviders,
  updateEmergencyProvider,
  listEmergencyBulletins,
  getEmergencyBulletin,
  rejectEmergencyBulletin,
  getEmergencyEvidence
} = require('../../usecases/emergency/adminEmergencyLayer');
const { fetchProviderSnapshot } = require('../../usecases/emergency/fetchProviderSnapshot');
const { normalizeAndDiffProvider } = require('../../usecases/emergency/normalizeAndDiffProvider');
const { summarizeDraftWithLLM } = require('../../usecases/emergency/summarizeDraftWithLLM');
const { approveEmergencyBulletin } = require('../../usecases/emergency/approveEmergencyBulletin');
const { previewEmergencyRule } = require('../../usecases/emergency/previewEmergencyRule');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const {
  resolveActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROOT_ROUTE_KEY = 'admin.emergency_layer';
const PROVIDERS_ROUTE_KEY = 'admin.emergency_providers_list';
const RULES_ROUTE_KEY = 'admin.emergency_rules_list';
const RULE_UPSERT_ROUTE_KEY = 'admin.emergency_rule_upsert';
const RULE_PREVIEW_ROUTE_KEY = 'admin.emergency_rule_preview';
const PROVIDER_UPDATE_ROUTE_KEY = 'admin.emergency_provider_update';
const PROVIDER_FORCE_REFRESH_ROUTE_KEY = 'admin.emergency_provider_force_refresh';
const BULLETINS_ROUTE_KEY = 'admin.emergency_bulletins_list';
const BULLETIN_DETAIL_ROUTE_KEY = 'admin.emergency_bulletin_detail';
const BULLETIN_REJECT_ROUTE_KEY = 'admin.emergency_bulletin_reject';
const BULLETIN_APPROVE_ROUTE_KEY = 'admin.emergency_bulletin_approve';
const EVIDENCE_ROUTE_KEY = 'admin.emergency_evidence_detail';

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function normalizeOutcomeReason(value, fallback) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
  return normalized || fallback;
}

function writeJson(res, routeKey, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJsonBody(bodyText, res, routeKey) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    writeJson(res, routeKey, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function parseProviderPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/providers\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim().toLowerCase();
}

function parseRulesPath(pathname) {
  return pathname === '/api/admin/emergency/rules';
}

function parseRulePath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/rules\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

function parseRulePreviewPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/rules\/([^/]+)\/preview$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

function parseProviderForcePath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/providers\/([^/]+)\/force-refresh$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim().toLowerCase();
}

function parseBulletinPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/bulletins\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

function parseBulletinActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/bulletins\/([^/]+)\/(approve|reject)$/);
  if (!match) return null;
  return {
    bulletinId: decodeURIComponent(match[1]).trim(),
    action: match[2]
  };
}

function parseEvidencePath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/evidence\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

async function handleListProviders(req, res, context) {
  const result = await listEmergencyProviders({
    traceId: context.traceId
  });
  writeJson(res, PROVIDERS_ROUTE_KEY, 200, result, {
    state: 'success',
    reason: 'completed'
  });
}

function parseBooleanQuery(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

async function handleListRules(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const result = await emergencyRulesRepo.listRules({
    providerKey: url.searchParams.get('providerKey'),
    enabled: parseBooleanQuery(url.searchParams.get('enabled')),
    limit: url.searchParams.get('limit')
  });
  writeJson(res, RULES_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    items: result
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleUpsertRule(req, res, bodyText, context, ruleId) {
  const payload = bodyText ? parseJsonBody(bodyText, res, RULE_UPSERT_ROUTE_KEY) : {};
  if (bodyText && !payload) return;
  const actionKey = ruleId ? 'emergency.rule.update' : 'emergency.rule.upsert';
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey,
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const item = await emergencyRulesRepo.upsertRule(ruleId || payload.ruleId, Object.assign({}, payload, {
    traceId: context.traceId
  }), context.actor);
  await appendAuditLog({
    actor: context.actor,
    action: actionKey,
    entityType: 'emergency_rule',
    entityId: item && item.ruleId ? item.ruleId : (ruleId || payload.ruleId || 'unknown'),
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      providerKey: item && item.providerKey ? item.providerKey : null,
      eventType: item && item.eventType ? item.eventType : null,
      enabled: item && item.enabled === true,
      autoSend: item && item.autoSend === true
    }
  });
  writeJson(res, RULE_UPSERT_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    item
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handlePreviewRule(req, res, bodyText, context, ruleId) {
  const payload = bodyText ? parseJsonBody(bodyText, res, RULE_PREVIEW_ROUTE_KEY) : {};
  if (bodyText && !payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'emergency.rule.preview',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const result = await previewEmergencyRule({
    ruleId,
    bulletinId: payload.bulletinId,
    limit: payload.limit,
    traceId: context.traceId
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'emergency.rule.preview',
    entityType: 'emergency_rule',
    entityId: ruleId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      ok: result && result.ok === true,
      matchCount: result && Number.isFinite(Number(result.matchCount)) ? Number(result.matchCount) : 0
    }
  });
  if (!result || result.ok !== true) {
    writeJson(
      res,
      RULE_PREVIEW_ROUTE_KEY,
      result && result.reason === 'rule_not_found' ? 404 : 400,
      Object.assign({ traceId: context.traceId }, result || { ok: false, error: 'preview_failed' }),
      {
        state: 'error',
        reason: normalizeOutcomeReason(result && result.reason, result && result.reason === 'rule_not_found' ? 'rule_not_found' : 'preview_failed')
      }
    );
    return;
  }
  writeJson(res, RULE_PREVIEW_ROUTE_KEY, 200, Object.assign({ traceId: context.traceId }, result), {
    state: 'success',
    reason: 'completed'
  });
}

async function handleUpdateProvider(req, res, bodyText, context, providerKey) {
  const payload = parseJsonBody(bodyText, res, PROVIDER_UPDATE_ROUTE_KEY);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'emergency.provider.update',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const result = await updateEmergencyProvider({
    providerKey,
    status: payload.status,
    scheduleMinutes: payload.scheduleMinutes,
    officialLinkRegistryId: payload.officialLinkRegistryId,
    actor: context.actor,
    requestId: context.requestId,
    traceId: context.traceId
  });
  writeJson(res, PROVIDER_UPDATE_ROUTE_KEY, 200, result, {
    state: result && result.ok === false ? 'degraded' : 'success',
    reason: result && result.ok === false
      ? normalizeOutcomeReason(result.reason, 'completed_with_issues')
      : 'completed'
  });
}

async function handleForceRefreshProvider(req, res, bodyText, context, providerKey) {
  const payload = bodyText ? parseJsonBody(bodyText, res, PROVIDER_FORCE_REFRESH_ROUTE_KEY) : {};
  if (bodyText && !payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'emergency.provider.force_refresh',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const provider = await emergencyProvidersRepo.getProvider(providerKey);
  if (!provider) {
    writeJson(res, PROVIDER_FORCE_REFRESH_ROUTE_KEY, 404, { ok: false, error: 'provider not found' }, {
      state: 'error',
      reason: 'provider_not_found'
    });
    return;
  }
  if (provider.status !== 'enabled') {
    writeJson(res, PROVIDER_FORCE_REFRESH_ROUTE_KEY, 409, { ok: false, error: 'provider_disabled' }, {
      state: 'blocked',
      reason: 'provider_disabled'
    });
    return;
  }
  const runId = `emg_force_${providerKey}_${Date.now()}`;
  const fetchResult = await fetchProviderSnapshot({
    providerKey,
    traceId: context.traceId,
    runId,
    actor: context.actor,
    forceRefresh: true
  });
  let normalizeResult = null;
  const summarizeResults = [];
  if (fetchResult && fetchResult.ok && fetchResult.changed !== false && Number(fetchResult.statusCode) !== 304) {
    normalizeResult = await normalizeAndDiffProvider({
      providerKey,
      snapshotId: fetchResult.snapshotId || null,
      payloadJson: fetchResult.payloadJson || null,
      payloadText: fetchResult.payloadText || null,
      traceId: context.traceId,
      runId,
      actor: context.actor
    });
    if (payload && payload.summarize === true && Array.isArray(normalizeResult.diffIds)) {
      for (const diffId of normalizeResult.diffIds) {
        const summary = await summarizeDraftWithLLM({
          diffId,
          traceId: context.traceId,
          runId: `${runId}__sum`,
          actor: context.actor
        });
        summarizeResults.push(summary);
      }
    }
  }
  await appendAuditLog({
    actor: context.actor,
    action: 'emergency.provider.force_refresh',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      fetchOk: Boolean(fetchResult && fetchResult.ok),
      snapshotId: fetchResult && fetchResult.snapshotId ? fetchResult.snapshotId : null
    }
  });
  writeJson(res, PROVIDER_FORCE_REFRESH_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    providerKey,
    fetchResult,
    normalizeResult,
    summarizeResults
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleListBulletins(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const result = await listEmergencyBulletins({
    status: url.searchParams.get('status'),
    regionKey: url.searchParams.get('regionKey'),
    limit: url.searchParams.get('limit'),
    traceId: context.traceId
  });
  writeJson(res, BULLETINS_ROUTE_KEY, 200, result, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleGetBulletin(req, res, context, bulletinId) {
  const result = await getEmergencyBulletin({
    bulletinId,
    traceId: context.traceId
  });
  writeJson(res, BULLETIN_DETAIL_ROUTE_KEY, 200, result, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleRejectBulletin(req, res, context, bulletinId) {
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'emergency.bulletin.reject',
    payload: {}
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const result = await rejectEmergencyBulletin({
    bulletinId,
    actor: context.actor,
    requestId: context.requestId,
    traceId: context.traceId
  });
  writeJson(res, BULLETIN_REJECT_ROUTE_KEY, 200, result, {
    state: result && result.ok === false ? 'degraded' : 'success',
    reason: result && result.ok === false
      ? normalizeOutcomeReason(result.reason, 'completed_with_issues')
      : 'completed'
  });
}

function resolveStatusCodeFromApproveResult(result) {
  if (!result || result.ok === true) return 200;
  if (result.partial === true || result.reason === 'send_partial_failure') return 207;
  if (result.blocked) return 409;
  if (result.reason === 'GUARD_BLOCK_WARN_LINK') return 409;
  if (result.reason === 'MISSING_LINK_REGISTRY_ID') return 409;
  if (result.reason === 'INVALID_CTA') return 409;
  return 400;
}

async function handleApproveBulletin(req, res, bodyText, context, bulletinId) {
  const payload = bodyText ? parseJsonBody(bodyText, res, BULLETIN_APPROVE_ROUTE_KEY) : {};
  if (bodyText && !payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'emergency.bulletin.approve',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const result = await approveEmergencyBulletin({
    bulletinId,
    ctaText: payload && payload.ctaText ? payload.ctaText : null,
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId
  });
  const statusCode = resolveStatusCodeFromApproveResult(result);
  writeJson(
    res,
    BULLETIN_APPROVE_ROUTE_KEY,
    statusCode,
    Object.assign({ traceId: context.traceId }, result),
    {
      state: statusCode === 207 ? 'partial' : (statusCode === 409 ? 'blocked' : (statusCode >= 400 ? 'error' : 'success')),
      reason: normalizeOutcomeReason(
        result && result.reason,
        statusCode === 207 ? 'send_partial_failure' : (statusCode === 409 ? 'blocked' : (statusCode >= 400 ? 'error' : 'completed'))
      )
    }
  );
}

async function handleGetEvidence(req, res, context, bulletinId) {
  const url = new URL(req.url, 'http://localhost');
  const result = await getEmergencyEvidence({
    bulletinId,
    unmappedLimit: url.searchParams.get('unmappedLimit'),
    traceId: context.traceId
  });
  writeJson(res, EVIDENCE_ROUTE_KEY, 200, result, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleEmergencyLayer(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };
  try {
    if (req.method === 'GET' && parseRulesPath(pathname)) {
      await handleListRules(req, res, context);
      return;
    }
    if (req.method === 'GET' && pathname === '/api/admin/emergency/providers') {
      await handleListProviders(req, res, context);
      return;
    }
    if (req.method === 'POST') {
      if (parseRulesPath(pathname)) {
        await handleUpsertRule(req, res, bodyText, context, null);
        return;
      }
      const rulePreviewId = parseRulePreviewPath(pathname);
      if (rulePreviewId) {
        await handlePreviewRule(req, res, bodyText, context, rulePreviewId);
        return;
      }
      const ruleId = parseRulePath(pathname);
      if (ruleId) {
        await handleUpsertRule(req, res, bodyText, context, ruleId);
        return;
      }
      const providerKey = parseProviderPath(pathname);
      if (providerKey) {
        await handleUpdateProvider(req, res, bodyText, context, providerKey);
        return;
      }
      const forceProviderKey = parseProviderForcePath(pathname);
      if (forceProviderKey) {
        await handleForceRefreshProvider(req, res, bodyText, context, forceProviderKey);
        return;
      }
    }
    if (req.method === 'GET' && pathname === '/api/admin/emergency/bulletins') {
      await handleListBulletins(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const bulletinId = parseBulletinPath(pathname);
      if (bulletinId) {
        await handleGetBulletin(req, res, context, bulletinId);
        return;
      }
      const evidenceBulletinId = parseEvidencePath(pathname);
      if (evidenceBulletinId) {
        await handleGetEvidence(req, res, context, evidenceBulletinId);
        return;
      }
    }
    if (req.method === 'POST') {
      const action = parseBulletinActionPath(pathname);
      if (action && action.action === 'approve') {
        await handleApproveBulletin(req, res, bodyText, context, action.bulletinId);
        return;
      }
      if (action && action.action === 'reject') {
        await handleRejectBulletin(req, res, context, action.bulletinId);
        return;
      }
    }
    writeJson(res, ROOT_ROUTE_KEY, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
  } catch (err) {
    logRouteError('admin.emergency_layer', err, context);
    if (err && Number.isInteger(err.statusCode)) {
      writeJson(res, ROOT_ROUTE_KEY, err.statusCode, { ok: false, error: err.message || 'error' }, {
        state: err.statusCode === 409 ? 'blocked' : 'error',
        reason: err.statusCode === 404 ? 'not_found' : 'error'
      });
      return;
    }
    writeJson(res, ROOT_ROUTE_KEY, 500, { ok: false, error: 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleEmergencyLayer
};
