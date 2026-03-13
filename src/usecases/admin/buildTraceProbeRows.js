'use strict';

const { getTraceBundle } = require('./getTraceBundle');

function normalizeTraceId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function buildTraceProbeRow(traceId, bundle, loadMs) {
  const summary = bundle && bundle.traceJoinSummary && typeof bundle.traceJoinSummary === 'object'
    ? bundle.traceJoinSummary
    : {};
  const joinedDomains = Array.isArray(summary.joinedDomains) ? summary.joinedDomains.slice() : [];
  const missingDomains = Array.isArray(summary.missingDomains) ? summary.missingDomains.slice() : [];
  const expectedDomains = Array.isArray(summary.expectedDomains) ? summary.expectedDomains.slice() : [];
  const criticalMissingDomains = Array.isArray(summary.criticalMissingDomains) ? summary.criticalMissingDomains.slice() : [];
  const observesDomain = (domainKey) => expectedDomains.includes(domainKey) || joinedDomains.includes(domainKey) || missingDomains.includes(domainKey);
  const joinedDomain = (domainKey) => joinedDomains.includes(domainKey) && !missingDomains.includes(domainKey);
  const createdAt = bundle && bundle.audits && bundle.audits[0] && bundle.audits[0].createdAt
    ? bundle.audits[0].createdAt
    : new Date().toISOString();
  return {
    traceId,
    createdAt,
    traceJoinCompleteness: Number.isFinite(Number(summary.completeness)) ? Number(summary.completeness) : null,
    adminTraceResolutionTimeMs: Number.isFinite(Number(loadMs)) ? Number(loadMs) : null,
    traceBundleLoadMs: Number.isFinite(Number(loadMs)) ? Number(loadMs) : null,
    joinedDomains,
    missingDomains,
    expectedDomains,
    criticalMissingDomains,
    joinedDomainCount: joinedDomains.length,
    missingDomainCount: missingDomains.length,
    cityPackGrounded: observesDomain('cityPack') ? joinedDomain('cityPack') : null,
    cityPackGroundedObserved: observesDomain('cityPack'),
    emergencyOfficialSourceSatisfied: observesDomain('emergency') ? joinedDomain('emergency') : null,
    emergencyOfficialSourceSatisfiedObserved: observesDomain('emergency'),
    journeyAlignedAction: observesDomain('journey') ? joinedDomain('journey') : null,
    journeyAlignedActionObserved: observesDomain('journey'),
    provenance: 'trace_bundle_probe'
  };
}

async function buildTraceProbeRows(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(100, Math.floor(Number(payload.limit)))) : 50;
  const getTraceBundleFn = deps && typeof deps.getTraceBundle === 'function' ? deps.getTraceBundle : getTraceBundle;
  const rawTraceIds = Array.isArray(payload.traceIds) ? payload.traceIds : [];
  const traceIds = Array.from(new Set(rawTraceIds.map((item) => normalizeTraceId(item)).filter(Boolean))).slice(0, limit);
  const rows = [];
  for (const traceId of traceIds) {
    const startedAt = Date.now();
    try {
      const bundle = await getTraceBundleFn({ traceId, limit: 50 });
      rows.push(buildTraceProbeRow(traceId, bundle, Date.now() - startedAt));
    } catch (_err) {
      rows.push({
        traceId,
        createdAt: new Date().toISOString(),
        traceJoinCompleteness: null,
        adminTraceResolutionTimeMs: null,
        traceBundleLoadMs: null,
        joinedDomains: [],
        missingDomains: [],
        joinedDomainCount: 0,
        missingDomainCount: 0,
        provenance: 'trace_bundle_probe_error'
      });
    }
  }
  return rows.sort((left, right) => {
    const rightMs = toMillis(right && right.createdAt) || 0;
    const leftMs = toMillis(left && left.createdAt) || 0;
    return rightMs - leftMs;
  });
}

module.exports = {
  buildTraceProbeRows
};
