'use strict';

const { createLink } = require('../../usecases/linkRegistry/createLink');
const { listLinks } = require('../../usecases/linkRegistry/listLinks');
const { updateLink } = require('../../usecases/linkRegistry/updateLink');
const { deleteLink } = require('../../usecases/linkRegistry/deleteLink');
const { checkLinkHealth } = require('../../usecases/linkRegistry/checkLinkHealth');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveRequestId, resolveTraceId } = require('./osContext');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

function writeError(res, err) {
  const status = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const payload = { ok: false, error: err && err.code ? String(err.code) : 'error' };
  if (err && err.details && typeof err.details === 'object') payload.details = err.details;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function handleCreate(req, res, body) {
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    writeError(res, err);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items: result }));
  } catch (err) {
    writeError(res, err);
  }
}

async function handleUpdate(req, res, body, id) {
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    writeError(res, err);
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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

async function handleHealth(req, res, body, id) {
  const payload = parseJson(body, res);
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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

module.exports = {
  handleCreate,
  handleList,
  handleUpdate,
  handleDelete,
  handleHealth
};
