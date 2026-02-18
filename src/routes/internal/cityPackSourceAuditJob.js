'use strict';

const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');

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

function resolveInternalToken(req) {
  const header = req && req.headers ? req.headers['x-city-pack-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return '';
}

function requireInternalJobToken(req, res) {
  const expected = process.env.CITY_PACK_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'CITY_PACK_JOB_TOKEN not configured' });
    return false;
  }
  const actual = resolveInternalToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleCityPackSourceAuditJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : null;
  const result = await runCityPackSourceAuditJob({
    runId: payload.runId,
    mode: payload.mode,
    targetSourceRefIds: payload.targetSourceRefIds,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_source_audit_job',
    requestId: payload.requestId || null
  });
  writeJson(res, 200, result);
}

module.exports = {
  handleCityPackSourceAuditJob,
  requireInternalJobToken
};
