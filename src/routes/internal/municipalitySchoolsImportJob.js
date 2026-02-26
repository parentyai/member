'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { importMunicipalitySchools } = require('../../usecases/cityPack/importMunicipalitySchools');

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

async function handleMunicipalitySchoolsImportJob(req, res, bodyText) {
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

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  const result = await importMunicipalitySchools({
    rows: payload.rows,
    dryRun: payload.dryRun === true,
    regionKey: payload.regionKey,
    traceId: traceIdHeader || payload.traceId || null,
    requestId: payload.requestId || null,
    actor: 'city_pack_municipality_schools_import_job'
  });
  writeJson(res, 200, result);
}

module.exports = {
  handleMunicipalitySchoolsImportJob
};
