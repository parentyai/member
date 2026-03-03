'use strict';

const { verifyTaskApiRequestSignature } = require('../domain/tasks/signature');
const { listUserTasks } = require('../usecases/tasks/listUserTasks');
const { patchTaskState } = require('../usecases/tasks/patchTaskState');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function normalizePathname(value) {
  const raw = typeof value === 'string' ? value.trim() : '/';
  if (!raw || raw === '/') return '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function parseTaskIdFromPath(pathname) {
  const normalized = normalizePathname(pathname);
  const match = normalized.match(/^\/api\/tasks\/([^/]+)$/);
  if (!match) return '';
  return decodeURIComponent(match[1]);
}

function verifySignature(req, pathname, taskId) {
  const url = new URL(req.url, 'http://localhost');
  const userId = url.searchParams.get('userId') || '';
  const ts = url.searchParams.get('ts') || '';
  const sig = url.searchParams.get('sig') || '';
  const result = verifyTaskApiRequestSignature({
    method: req.method,
    pathname,
    userId,
    taskId: taskId || '',
    ts,
    sig
  });
  return Object.assign({ userId }, result);
}

function readHeader(req, key) {
  const value = req && req.headers ? req.headers[key] : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

async function handleTasksRoute(req, res, bodyText, pathname) {
  const normalizedPath = normalizePathname(pathname || req.url || '/');
  if (req.method === 'GET' && normalizedPath === '/api/tasks') {
    const auth = verifySignature(req, normalizedPath);
    if (!auth.ok) {
      writeJson(res, auth.reason === 'expired' ? 401 : 403, { ok: false, error: auth.reason || 'unauthorized' });
      return;
    }
    const result = await listUserTasks({
      userId: auth.userId,
      forceRefresh: false,
      actor: 'task_api_get'
    });
    writeJson(res, 200, {
      ok: true,
      userId: auth.userId,
      tasks: result.tasks || []
    });
    return;
  }

  if (req.method === 'PATCH' && normalizedPath.startsWith('/api/tasks/')) {
    const taskId = parseTaskIdFromPath(normalizedPath);
    if (!taskId) {
      writeJson(res, 404, { ok: false, error: 'not found' });
      return;
    }
    const auth = verifySignature(req, normalizedPath, taskId);
    if (!auth.ok) {
      writeJson(res, auth.reason === 'expired' ? 401 : 403, { ok: false, error: auth.reason || 'unauthorized' });
      return;
    }
    const payload = parseJson(bodyText);
    if (!payload) {
      writeJson(res, 400, { ok: false, error: 'invalid json' });
      return;
    }
    try {
      const result = await patchTaskState({
        userId: auth.userId,
        taskId,
        action: payload.action,
        status: payload.status,
        snoozeUntil: payload.snoozeUntil,
        nextNudgeAt: payload.nextNudgeAt,
        blockedReason: payload.blockedReason,
        actor: 'task_api_patch',
        traceId: readHeader(req, 'x-trace-id'),
        requestId: readHeader(req, 'x-request-id')
      });
      writeJson(res, 200, result);
    } catch (err) {
      const message = err && err.message ? err.message : 'error';
      if (message.includes('not found')) {
        writeJson(res, 404, { ok: false, error: message });
        return;
      }
      if (message.includes('required') || message.includes('invalid') || message.includes('mismatch')) {
        writeJson(res, 400, { ok: false, error: message });
        return;
      }
      writeJson(res, 500, { ok: false, error: 'error' });
    }
    return;
  }

  writeJson(res, 404, { ok: false, error: 'not found' });
}

module.exports = {
  handleTasksRoute
};
