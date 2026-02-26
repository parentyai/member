'use strict';

const municipalitySchoolsRepo = require('../../repos/firestore/municipalitySchoolsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

function normalizeRows(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((row) => row && typeof row === 'object');
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRegionKey(value) {
  const regionKey = normalizeString(value);
  return regionKey ? regionKey.toLowerCase() : null;
}

function normalizeSchoolRow(input, defaultRegionKey) {
  const row = input && typeof input === 'object' ? input : {};
  const regionKey = normalizeRegionKey(row.regionKey || defaultRegionKey);
  const name = normalizeString(row.name);
  const district = normalizeString(row.district);
  const sourceLinkRegistryId = normalizeString(row.sourceLinkRegistryId);
  const sourceUrl = normalizeString(row.sourceUrl);
  const schoolType = normalizeSchoolType(row.type || row.schoolType);
  return {
    id: normalizeString(row.id),
    regionKey,
    name,
    district,
    sourceLinkRegistryId,
    sourceUrl,
    schoolType
  };
}

function normalizeSchoolType(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw === 'public' || raw.includes('public')) return 'public';
  if (raw === 'private' || raw.includes('private')) return 'private';
  return raw;
}

async function resolveSourceLink(row, traceId, deps) {
  const getLink = deps && typeof deps.getLink === 'function' ? deps.getLink : linkRegistryRepo.getLink;
  const createLink = deps && typeof deps.createLink === 'function' ? deps.createLink : linkRegistryRepo.createLink;

  if (row.sourceLinkRegistryId) {
    const link = await getLink(row.sourceLinkRegistryId);
    if (!link) throw new Error('source link not found');
    const schoolType = normalizeSchoolType(link.schoolType);
    if (schoolType !== 'public') throw new Error('source link schoolType must be public');
    return {
      sourceLinkRegistryId: row.sourceLinkRegistryId,
      sourceUrl: typeof link.url === 'string' ? link.url.trim() : ''
    };
  }

  if (!row.sourceUrl) throw new Error('sourceUrl required');
  const created = await createLink({
    title: `${row.name} official source`,
    url: row.sourceUrl,
    domainClass: 'school_public',
    schoolType: 'public',
    eduScope: 'district_info',
    regionKey: row.regionKey,
    tags: ['education', 'public'],
    traceId
  });
  const link = await getLink(created.id);
  return {
    sourceLinkRegistryId: created.id,
    sourceUrl: link && typeof link.url === 'string' ? link.url.trim() : row.sourceUrl
  };
}

async function importMunicipalitySchools(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const actor = normalizeString(payload.actor) || 'city_pack_municipality_schools_import';
  const traceId = normalizeString(payload.traceId) || `trace-city-pack-municipality-schools-${Date.now()}`;
  const requestId = normalizeString(payload.requestId);
  const defaultRegionKey = normalizeRegionKey(payload.regionKey);
  const dryRun = payload.dryRun === true;
  const rows = normalizeRows(payload.rows);
  if (!rows.length) throw new Error('rows required');

  const upsertSchool = deps && typeof deps.upsertSchool === 'function'
    ? deps.upsertSchool
    : municipalitySchoolsRepo.upsertSchool;
  const audit = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const rawRow of rows) {
    processed += 1;
    try {
      const row = normalizeSchoolRow(rawRow, defaultRegionKey);
      if (!row.regionKey || !row.name || !row.district) {
        throw new Error('regionKey/name/district required');
      }
      if (row.schoolType && row.schoolType !== 'public') {
        throw new Error('school type must be public');
      }
      const sourceLink = await resolveSourceLink(row, traceId, deps);
      if (!sourceLink.sourceUrl) throw new Error('sourceUrl required');
      if (!dryRun) {
        await upsertSchool({
          id: row.id,
          regionKey: row.regionKey,
          name: row.name,
          type: 'public',
          district: row.district,
          sourceLinkRegistryId: sourceLink.sourceLinkRegistryId,
          sourceUrl: sourceLink.sourceUrl,
          lastFetchedAt: payload.now || new Date().toISOString(),
          traceId
        });
      }
      succeeded += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        index: processed - 1,
        message: err && err.message ? String(err.message) : 'error'
      });
    }
  }

  await audit({
    actor,
    action: 'city_pack.education.municipality_schools_import',
    entityType: 'municipality_schools',
    entityId: defaultRegionKey || 'bulk',
    traceId,
    requestId: requestId || null,
    payloadSummary: {
      dryRun,
      processed,
      succeeded,
      failed
    }
  });

  return {
    ok: failed === 0,
    dryRun,
    processed,
    succeeded,
    failed,
    errors,
    traceId
  };
}

module.exports = {
  importMunicipalitySchools
};
