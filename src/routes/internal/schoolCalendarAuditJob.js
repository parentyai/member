'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const schoolCalendarLinksRepo = require('../../repos/firestore/schoolCalendarLinksRepo');
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

async function handleSchoolCalendarAuditJob(req, res, bodyText) {
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

  const links = await schoolCalendarLinksRepo.listSchoolCalendarLinks({
    limit: Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : 500,
    regionKey: payload.regionKey || undefined,
    schoolYear: payload.schoolYear || undefined,
    status: 'active'
  });
  const targetSourceRefIds = Array.from(new Set(
    links
      .map((item) => (item && typeof item.sourceRefId === 'string' ? item.sourceRefId.trim() : ''))
      .filter(Boolean)
  ));

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  const result = await runCityPackSourceAuditJob({
    runId: payload.runId,
    mode: payload.mode,
    stage: payload.stage || 'heavy',
    packClass: payload.packClass || null,
    targetSourceRefIds,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_school_calendar_audit_job',
    requestId: payload.requestId || null
  });
  writeJson(res, 200, Object.assign({}, result, {
    targetSourceRefIds,
    targetCount: targetSourceRefIds.length
  }));
}

module.exports = {
  handleSchoolCalendarAuditJob
};
