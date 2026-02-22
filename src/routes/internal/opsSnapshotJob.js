'use strict';

const { buildOpsSnapshots } = require('../../usecases/admin/buildOpsSnapshots');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');

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

async function handleOpsSnapshotJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const killSwitch = await getKillSwitch();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : (typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null);

  const result = await buildOpsSnapshots({
    dryRun: payload.dryRun === true,
    scanLimit: payload.scanLimit,
    windowMonths: payload.windowMonths,
    targets: payload.targets,
    lineUserIds: payload.lineUserIds,
    traceId,
    requestId: payload.requestId || null,
    actor: 'ops_snapshot_job'
  });

  writeJson(res, 200, result);
}

module.exports = {
  handleOpsSnapshotJob
};
