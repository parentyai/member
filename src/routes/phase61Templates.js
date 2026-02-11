'use strict';

const templatesRepo = require('../repos/firestore/notificationTemplatesRepo');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./admin/osContext');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid') || message.includes('exists')
    || message.includes('not found') || message.includes('editable')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

function parsePath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const key = parts.length >= 4 ? parts[3] : null;
  const action = parts.length >= 5 ? parts[4] : null;
  return { key, action, parts };
}

async function handleTemplates(req, res, body, pathname) {
  const { key, action, parts } = parsePath(pathname);
  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    if (req.method === 'GET' && parts.length === 3) {
      const url = new URL(req.url, 'http://localhost');
      const status = url.searchParams.get('status');
      const items = await templatesRepo.listTemplates({ status });
      try {
        await appendAuditLog({
          actor,
          action: 'templates.list',
          entityType: 'template',
          entityId: status || 'all',
          traceId,
          requestId,
          payloadSummary: { status: status || null, count: Array.isArray(items) ? items.length : 0 }
        });
      } catch (_err) {
        // best-effort only
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, items }));
      return;
    }
    if (req.method === 'POST' && parts.length === 3) {
      const payload = parseJson(body, res);
      if (!payload) return;
      const created = await templatesRepo.createTemplate(payload);
      try {
        await appendAuditLog({
          actor,
          action: 'templates.create',
          entityType: 'template',
          entityId: payload.key || created.id,
          traceId,
          requestId,
          payloadSummary: {
            key: payload.key || null,
            notificationCategory: payload.notificationCategory || null
          }
        });
      } catch (_err) {
        // best-effort only
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, created }));
      return;
    }
    if (req.method === 'PATCH' && key && !action) {
      const payload = parseJson(body, res);
      if (!payload) return;
      const updated = await templatesRepo.updateTemplate(key, payload);
      try {
        await appendAuditLog({
          actor,
          action: 'templates.update',
          entityType: 'template',
          entityId: key,
          traceId,
          requestId,
          payloadSummary: { fields: Object.keys(payload || {}) }
        });
      } catch (_err) {
        // best-effort only
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updated }));
      return;
    }
    if (req.method === 'POST' && key && action === 'activate') {
      const updated = await templatesRepo.setStatus(key, 'active');
      try {
        await appendAuditLog({
          actor,
          action: 'templates.activate',
          entityType: 'template',
          entityId: key,
          traceId,
          requestId,
          payloadSummary: { status: 'active' }
        });
      } catch (_err) {
        // best-effort only
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updated }));
      return;
    }
    if (req.method === 'POST' && key && action === 'deactivate') {
      const updated = await templatesRepo.setStatus(key, 'inactive');
      try {
        await appendAuditLog({
          actor,
          action: 'templates.deactivate',
          entityType: 'template',
          entityId: key,
          traceId,
          requestId,
          payloadSummary: { status: 'inactive' }
        });
      } catch (_err) {
        // best-effort only
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updated }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleTemplates
};
