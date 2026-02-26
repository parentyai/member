'use strict';

const crypto = require('crypto');
const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const emergencySnapshotsRepo = require('../../repos/firestore/emergencySnapshotsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { getProviderDefinition } = require('./providers');
const { appendEmergencyAudit } = require('./audit');
const { stableHash, normalizeString } = require('./utils');

const MAX_SNAPSHOT_PAYLOAD_BYTES = 900000;

function resolveFetchFn(deps) {
  if (deps && typeof deps.fetchFn === 'function') return deps.fetchFn;
  if (typeof fetch === 'function') return fetch;
  throw new Error('fetch unavailable');
}

function resolveNow(params, deps) {
  if (params && params.now instanceof Date) return params.now;
  if (deps && deps.now instanceof Date) return deps.now;
  return new Date();
}

function resolveTraceId(params, now) {
  const explicit = normalizeString(params && params.traceId);
  if (explicit) return explicit;
  return `trace_emergency_${now.getTime()}_${crypto.randomUUID().slice(0, 8)}`;
}

function resolveRunId(params, providerKey, now) {
  const explicit = normalizeString(params && params.runId);
  if (explicit) return explicit;
  return `emg_${providerKey}_${now.getTime()}`;
}

function parsePayloadText(text) {
  const body = typeof text === 'string' ? text : '';
  if (!body.trim()) return null;
  try {
    return JSON.parse(body);
  } catch (_err) {
    return null;
  }
}

function buildPayloadSummary(payloadText, payloadJson) {
  if (payloadJson && typeof payloadJson === 'object') {
    if (Array.isArray(payloadJson)) {
      return {
        kind: 'array',
        length: payloadJson.length,
        keys: []
      };
    }
    const keys = Object.keys(payloadJson).slice(0, 30);
    return {
      kind: 'object',
      keys,
      keyCount: Object.keys(payloadJson).length
    };
  }
  return {
    kind: 'text',
    length: payloadText.length
  };
}

function resolveHeader(headers, key) {
  if (!headers || typeof headers.get !== 'function') return null;
  const value = headers.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function fetchProviderSnapshot(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const providerKey = normalizeString(payload.providerKey);
  if (!providerKey) throw new Error('providerKey required');
  const forceRefresh = payload.forceRefresh === true;

  const now = resolveNow(payload, deps);
  const traceId = resolveTraceId(payload, now);
  const runId = resolveRunId(payload, providerKey, now);
  const actor = normalizeString(payload.actor) || 'emergency_provider_fetch_job';

  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;
  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.fetch.blocked',
      entityType: 'emergency_provider',
      entityId: providerKey,
      traceId,
      runId,
      payloadSummary: { reason: 'kill_switch_on' }
    }, deps);
    return {
      ok: false,
      blocked: true,
      reason: 'kill_switch_on',
      providerKey,
      runId,
      traceId
    };
  }

  const provider = await emergencyProvidersRepo.getProvider(providerKey);
  if (!provider) throw new Error(`provider not found: ${providerKey}`);
  if (provider.status !== 'enabled') {
    await emergencyProvidersRepo.upsertProvider(providerKey, {
      lastRunAt: now.toISOString(),
      traceId
    });
    return {
      ok: true,
      skipped: true,
      reason: 'provider_disabled',
      providerKey,
      runId,
      traceId
    };
  }

  const definition = getProviderDefinition(providerKey);
  const endpoint = definition.endpoint();
  if (!endpoint) {
    await emergencyProvidersRepo.upsertProvider(providerKey, {
      lastRunAt: now.toISOString(),
      lastError: 'provider endpoint missing',
      traceId
    });
    return {
      ok: false,
      providerKey,
      runId,
      traceId,
      reason: 'endpoint_missing'
    };
  }

  const requestHeaders = Object.assign({}, definition.headers());
  if (!forceRefresh) {
    if (normalizeString(provider.lastEtag)) requestHeaders['If-None-Match'] = provider.lastEtag;
    if (normalizeString(provider.lastModified)) requestHeaders['If-Modified-Since'] = provider.lastModified;
  }

  const fetchFn = resolveFetchFn(deps);
  const requestInit = {
    method: definition.method || 'GET',
    headers: requestHeaders
  };

  await appendEmergencyAudit({
    actor,
    action: 'emergency.provider.fetch.start',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId,
    runId,
    payloadSummary: {
      endpoint,
      method: requestInit.method,
      hasEtag: Boolean(requestHeaders['If-None-Match']),
      hasLastModified: Boolean(requestHeaders['If-Modified-Since']),
      forceRefresh
    }
  }, deps);

  let response;
  try {
    response = await fetchFn(endpoint, requestInit);
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'provider fetch failed';
    await emergencyProvidersRepo.upsertProvider(providerKey, {
      lastRunAt: now.toISOString(),
      lastError: message,
      traceId
    });
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.fetch.error',
      entityType: 'emergency_provider',
      entityId: providerKey,
      traceId,
      runId,
      payloadSummary: {
        endpoint,
        error: message
      }
    }, deps);
    return {
      ok: false,
      providerKey,
      runId,
      traceId,
      reason: 'fetch_error',
      error: message
    };
  }

  const statusCode = Number(response.status || 0);
  const etag = resolveHeader(response.headers, 'etag');
  const lastModified = resolveHeader(response.headers, 'last-modified');

  if (statusCode === 304) {
    const snapshotId = `${providerKey}__${runId}`;
    await emergencySnapshotsRepo.saveSnapshot(snapshotId, {
      providerKey,
      fetchedAt: now.toISOString(),
      statusCode,
      etag,
      lastModified,
      payloadHash: normalizeString(provider.lastPayloadHash),
      payloadSummary: { kind: 'not_modified' },
      rawPayload: null,
      runId,
      traceId
    });
    await emergencyProvidersRepo.upsertProvider(providerKey, {
      lastRunAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      lastError: null,
      lastEtag: etag || provider.lastEtag || null,
      lastModified: lastModified || provider.lastModified || null,
      traceId
    });
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.fetch.not_modified',
      entityType: 'emergency_provider',
      entityId: providerKey,
      traceId,
      runId,
      payloadSummary: {
        snapshotId,
        statusCode,
        forceRefresh
      }
    }, deps);
    return {
      ok: true,
      providerKey,
      runId,
      traceId,
      snapshotId,
      statusCode,
      changed: false,
      payloadHash: normalizeString(provider.lastPayloadHash) || null,
      payloadText: null,
      payloadJson: null
    };
  }

  const payloadText = await response.text();
  const payloadJson = parsePayloadText(payloadText);
  const payloadHash = stableHash(payloadText || '{}');
  const previousHash = normalizeString(provider.lastPayloadHash);
  const changed = payloadHash !== previousHash;
  const payloadSummary = buildPayloadSummary(payloadText, payloadJson);

  const rawPayload = payloadText.length <= MAX_SNAPSHOT_PAYLOAD_BYTES
    ? (payloadJson || payloadText)
    : null;
  const snapshotId = `${providerKey}__${runId}`;

  await emergencySnapshotsRepo.saveSnapshot(snapshotId, {
    providerKey,
    fetchedAt: now.toISOString(),
    statusCode,
    etag,
    lastModified,
    payloadHash,
    payloadSummary: Object.assign({}, payloadSummary, {
      truncated: rawPayload === null,
      rawLength: payloadText.length
    }),
    rawPayload,
    runId,
    traceId
  });

  await emergencyProvidersRepo.upsertProvider(providerKey, {
    lastRunAt: now.toISOString(),
    lastSuccessAt: statusCode >= 200 && statusCode < 300 ? now.toISOString() : provider.lastSuccessAt || null,
    lastError: statusCode >= 200 && statusCode < 300 ? null : `status_${statusCode}`,
    lastPayloadHash: statusCode >= 200 && statusCode < 300 ? payloadHash : provider.lastPayloadHash || null,
    lastEtag: etag || provider.lastEtag || null,
    lastModified: lastModified || provider.lastModified || null,
    traceId
  });

  await appendEmergencyAudit({
    actor,
    action: 'emergency.provider.fetch.finish',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId,
    runId,
    payloadSummary: {
      endpoint,
      snapshotId,
      statusCode,
      changed,
      payloadHash,
      truncated: rawPayload === null,
      forceRefresh
    }
  }, deps);

  return {
    ok: statusCode >= 200 && statusCode < 300,
    providerKey,
    runId,
    traceId,
    snapshotId,
    statusCode,
    changed,
    payloadHash,
    payloadText,
    payloadJson
  };
}

module.exports = {
  fetchProviderSnapshot
};
