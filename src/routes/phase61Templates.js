'use strict';

const templatesRepo = require('../repos/firestore/notificationTemplatesRepo');

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
  try {
    if (req.method === 'GET' && parts.length === 3) {
      const url = new URL(req.url, 'http://localhost');
      const status = url.searchParams.get('status');
      const items = await templatesRepo.listTemplates({ status });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, items }));
      return;
    }
    if (req.method === 'POST' && parts.length === 3) {
      const payload = parseJson(body, res);
      if (!payload) return;
      const created = await templatesRepo.createTemplate(payload);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, created }));
      return;
    }
    if (req.method === 'PATCH' && key && !action) {
      const payload = parseJson(body, res);
      if (!payload) return;
      const updated = await templatesRepo.updateTemplate(key, payload);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updated }));
      return;
    }
    if (req.method === 'POST' && key && action === 'activate') {
      const updated = await templatesRepo.setStatus(key, 'active');
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, updated }));
      return;
    }
    if (req.method === 'POST' && key && action === 'deactivate') {
      const updated = await templatesRepo.setStatus(key, 'inactive');
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
