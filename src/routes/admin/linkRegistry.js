'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { createLink } = require('../../usecases/linkRegistry/createLink');
const { listLinks } = require('../../usecases/linkRegistry/listLinks');
const { updateLink } = require('../../usecases/linkRegistry/updateLink');
const { deleteLink } = require('../../usecases/linkRegistry/deleteLink');
const { checkLinkHealth } = require('../../usecases/linkRegistry/checkLinkHealth');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveRequestId, resolveTraceId } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const CREATE_ROUTE_KEY = 'admin.link_registry_create';
const LIST_ROUTE_KEY = 'admin.link_registry_list';
const UPDATE_ROUTE_KEY = 'admin.link_registry_update';
const DELETE_ROUTE_KEY = 'admin.link_registry_delete';
const HEALTH_ROUTE_KEY = 'admin.link_registry_health';

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function normalizeReason(message, fallback) {
  const text = typeof message === 'string' ? message : '';
  const normalized = text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return normalized || fallback;
}

function parseJson(body, res, routeKey) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    writeJson(res, routeKey, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function writeError(res, routeKey, err) {
  const status = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const payload = { ok: false, error: err && err.code ? String(err.code) : 'error' };
  if (err && err.details && typeof err.details === 'object') payload.details = err.details;
  writeJson(res, routeKey, status, payload, {
    state: status >= 500 ? 'error' : 'error',
    reason: normalizeReason(payload.error, 'error')
  });
}

async function handleCreate(req, res, body) {
  const payload = parseJson(body, res, CREATE_ROUTE_KEY);
  if (!payload) return;
  try {
    const result = await createLink(payload);
    const actor = resolveActor(req);
    const traceId = resolveTraceId(req);
    const requestId = resolveRequestId(req);
    await appendAuditLog({
      actor,
      action: 'link_registry.create',
      entityType: 'link_registry',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { title: payload.title || null }
    });
    writeJson(res, CREATE_ROUTE_KEY, 200, { ok: true, id: result.id }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    writeError(res, CREATE_ROUTE_KEY, err);
  }
}

async function handleList(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const state = url.searchParams.get('state');
  const domainClass = url.searchParams.get('domainClass');
  const schoolType = url.searchParams.get('schoolType');
  const eduScope = url.searchParams.get('eduScope');
  const regionKey = url.searchParams.get('regionKey');
  const intentTag = url.searchParams.get('intentTag');
  const audienceTag = url.searchParams.get('audienceTag');
  const regionScope = url.searchParams.get('regionScope');
  const riskLevel = url.searchParams.get('riskLevel');
  const tagsRaw = url.searchParams.get('tags');
  const tags = typeof tagsRaw === 'string' && tagsRaw.trim()
    ? tagsRaw.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  try {
    const result = await listLinks({
      limit: limit ? Number(limit) : undefined,
      state: state || undefined,
      domainClass: domainClass || undefined,
      schoolType: schoolType || undefined,
      eduScope: eduScope || undefined,
      regionKey: regionKey || undefined,
      intentTag: intentTag || undefined,
      audienceTag: audienceTag || undefined,
      regionScope: regionScope || undefined,
      riskLevel: riskLevel || undefined,
      tags
    });
    writeJson(res, LIST_ROUTE_KEY, 200, { ok: true, items: result }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    writeError(res, LIST_ROUTE_KEY, err);
  }
}

async function handleUpdate(req, res, body, id) {
  const payload = parseJson(body, res, UPDATE_ROUTE_KEY);
  if (!payload) return;
  try {
    const result = await updateLink(id, payload);
    const actor = resolveActor(req);
    const traceId = resolveTraceId(req);
    const requestId = resolveRequestId(req);
    await appendAuditLog({
      actor,
      action: 'link_registry.update',
      entityType: 'link_registry',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { fields: Object.keys(payload || {}) }
    });
    writeJson(res, UPDATE_ROUTE_KEY, 200, { ok: true, id: result.id }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    writeError(res, UPDATE_ROUTE_KEY, err);
  }
}

async function handleDelete(req, res, id) {
  const result = await deleteLink(id);
  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  await appendAuditLog({
    actor,
    action: 'link_registry.delete',
    entityType: 'link_registry',
    entityId: result.id,
    traceId,
    requestId,
    payloadSummary: {}
  });
  writeJson(res, DELETE_ROUTE_KEY, 200, { ok: true, id: result.id }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleHealth(req, res, body, id) {
  const payload = parseJson(body, res, HEALTH_ROUTE_KEY);
  if (!payload) return;
  const result = await checkLinkHealth(id, payload);
  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  await appendAuditLog({
    actor,
    action: 'link_registry.health',
    entityType: 'link_registry',
    entityId: result.id,
    traceId,
    requestId,
    payloadSummary: { state: payload.state || null, statusCode: payload.statusCode || null }
  });
  writeJson(res, HEALTH_ROUTE_KEY, 200, { ok: true, id: result.id }, {
    state: 'success',
    reason: 'completed'
  });
}

module.exports = {
  handleCreate,
  handleList,
  handleUpdate,
  handleDelete,
  handleHealth
};
