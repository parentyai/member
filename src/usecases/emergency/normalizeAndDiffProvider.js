'use strict';

const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const emergencySnapshotsRepo = require('../../repos/firestore/emergencySnapshotsRepo');
const emergencyEventsRepo = require('../../repos/firestore/emergencyEventsRepo');
const emergencyDiffsRepo = require('../../repos/firestore/emergencyDiffsRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const emergencyUnmappedEventsRepo = require('../../repos/firestore/emergencyUnmappedEventsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { getProviderDefinition } = require('./providers');
const { resolveRegionKeys } = require('./regionResolvers');
const { appendEmergencyAudit } = require('./audit');
const { buildEmergencyMessageDraft } = require('./messageTemplates');
const { PROVIDER_CATEGORIES } = require('./constants');
const { normalizeString, stableHash, stableKey, pickChangedKeys } = require('./utils');

function parsePayloadText(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source.trim()) return null;
  try {
    return JSON.parse(source);
  } catch (_err) {
    return null;
  }
}

function resolvePayloadFromSnapshot(snapshot) {
  if (!snapshot) return { payloadObject: null, payloadText: '' };
  const raw = snapshot.rawPayload;
  if (raw && typeof raw === 'object') return { payloadObject: raw, payloadText: '' };
  if (typeof raw === 'string') return { payloadObject: parsePayloadText(raw), payloadText: raw };
  return { payloadObject: null, payloadText: '' };
}

function normalizeSeverity(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'CRITICAL' || raw === 'WARN' || raw === 'INFO') return raw;
  return 'WARN';
}

function normalizeCategory(value, fallback) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw) return raw;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'alert';
}

function normalizeHeadline(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 280) : 'Emergency update';
}

function normalizeRegionKey(value) {
  const regionKey = typeof value === 'string' ? value.trim() : '';
  return regionKey ? regionKey : null;
}

function buildEventDocId(providerKey, eventKey, regionKey) {
  return `eme_${stableKey([providerKey, eventKey, regionKey])}`;
}

function buildEventHash(source) {
  const payload = {
    eventKey: source.eventKey,
    regionKey: source.regionKey,
    severity: source.severity,
    category: source.category,
    headline: source.headline,
    startsAt: source.startsAt || null,
    endsAt: source.endsAt || null,
    officialLinkRegistryId: source.officialLinkRegistryId || null,
    rawMeta: source.rawMeta || null
  };
  return stableHash(payload);
}

function buildDiffDocId(runId, eventDocId, diffType, snapshotId, changedKeys) {
  const key = stableKey([
    runId || '',
    eventDocId || '',
    diffType || '',
    snapshotId || '',
    Array.isArray(changedKeys) ? changedKeys.join(',') : ''
  ]);
  return `edf_${key}`;
}

function buildChangedKeys(previous, current) {
  return pickChangedKeys(previous, current, [
    'severity',
    'category',
    'headline',
    'startsAt',
    'endsAt',
    'officialLinkRegistryId',
    'rawMeta',
    'isActive'
  ]);
}

async function normalizeAndDiffProvider(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const providerKey = normalizeString(payload.providerKey);
  if (!providerKey) throw new Error('providerKey required');

  const now = payload.now instanceof Date ? payload.now : new Date();
  const traceId = normalizeString(payload.traceId) || `trace_emergency_${now.getTime()}`;
  const runId = normalizeString(payload.runId) || `emg_norm_${providerKey}_${now.getTime()}`;
  const actor = normalizeString(payload.actor) || 'emergency_provider_normalize_job';

  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;
  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.normalize.blocked',
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
  let snapshot = null;
  if (normalizeString(payload.snapshotId)) {
    snapshot = await emergencySnapshotsRepo.getSnapshot(payload.snapshotId);
  }
  if (!snapshot) {
    snapshot = await emergencySnapshotsRepo.getLatestSnapshotByProvider(providerKey);
  }
  if (!snapshot) {
    return {
      ok: false,
      reason: 'snapshot_missing',
      providerKey,
      runId,
      traceId
    };
  }

  const inlinePayloadObject = payload.payloadJson && typeof payload.payloadJson === 'object'
    ? payload.payloadJson
    : null;
  const inlinePayloadText = typeof payload.payloadText === 'string' ? payload.payloadText : '';
  const snapshotPayload = resolvePayloadFromSnapshot(snapshot);
  const payloadObject = inlinePayloadObject || snapshotPayload.payloadObject || parsePayloadText(inlinePayloadText);
  const payloadText = inlinePayloadText || snapshotPayload.payloadText || '';

  if (!payloadObject && !payloadText) {
    return {
      ok: false,
      reason: 'snapshot_payload_unavailable',
      providerKey,
      runId,
      traceId,
      snapshotId: snapshot.id
    };
  }

  const parsedEvents = definition.parsePayload(payloadObject || {}, {
    payloadText,
    snapshot,
    provider
  });

  const events = Array.isArray(parsedEvents) ? parsedEvents : [];
  const existingEvents = await emergencyEventsRepo.listEventsByProvider(providerKey, 5000);
  const existingById = new Map(existingEvents.map((row) => [row.id, row]));
  const seenEventDocIds = new Set();

  const diffIds = [];
  const draftBulletinIds = [];
  let unmappedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let resolvedCount = 0;

  for (const rawEvent of events) {
    const eventKey = normalizeString(rawEvent && rawEvent.eventKey);
    if (!eventKey) continue;

    const regionResolution = resolveRegionKeys(rawEvent);
    if (!regionResolution.ok) {
      unmappedCount += 1;
      await emergencyUnmappedEventsRepo.saveUnmappedEvent({
        providerKey,
        eventKey,
        reason: regionResolution.reason || 'region_unresolved',
        snapshotId: snapshot.id,
        runId,
        traceId,
        rawMeta: {
          details: regionResolution.details || null,
          source: rawEvent && rawEvent.rawMeta ? rawEvent.rawMeta : null
        }
      });
      continue;
    }

    for (const regionKeyRaw of regionResolution.regionKeys) {
      const regionKey = normalizeRegionKey(regionKeyRaw);
      if (!regionKey) continue;

      const normalizedEvent = {
        providerKey,
        eventKey,
        regionKey,
        severity: normalizeSeverity(rawEvent && rawEvent.severity),
        category: normalizeCategory(rawEvent && rawEvent.category, PROVIDER_CATEGORIES[providerKey] || 'alert'),
        headline: normalizeHeadline(rawEvent && rawEvent.headline),
        startsAt: rawEvent && rawEvent.startsAt ? rawEvent.startsAt : null,
        endsAt: rawEvent && rawEvent.endsAt ? rawEvent.endsAt : null,
        officialLinkRegistryId: normalizeString(provider.officialLinkRegistryId),
        snapshotId: snapshot.id,
        runId,
        traceId,
        isActive: true,
        resolvedAt: null,
        rawMeta: rawEvent && rawEvent.rawMeta ? rawEvent.rawMeta : null
      };
      normalizedEvent.eventHash = buildEventHash(normalizedEvent);

      const eventDocId = buildEventDocId(providerKey, eventKey, regionKey);
      const previous = existingById.get(eventDocId) || null;
      const isNew = !previous || previous.isActive !== true;
      const hasChanged = previous ? previous.eventHash !== normalizedEvent.eventHash : true;

      await emergencyEventsRepo.upsertEvent(eventDocId, normalizedEvent);
      seenEventDocIds.add(eventDocId);

      if (!isNew && !hasChanged) continue;

      const diffType = isNew ? 'new' : 'update';
      const changedKeys = isNew
        ? ['severity', 'category', 'headline', 'startsAt', 'endsAt', 'officialLinkRegistryId', 'isActive']
        : buildChangedKeys(previous, normalizedEvent);

      const diff = await emergencyDiffsRepo.createDiff({
        id: buildDiffDocId(runId, eventDocId, diffType, snapshot.id, changedKeys),
        providerKey,
        regionKey,
        category: normalizedEvent.category,
        diffType,
        severity: normalizedEvent.severity,
        changedKeys,
        summaryDraft: null,
        snapshotId: snapshot.id,
        eventKey,
        eventDocId,
        runId,
        traceId
      });

      diffIds.push(diff.id);
      if (diffType === 'new') createdCount += 1;
      if (diffType === 'update') updatedCount += 1;

      if (normalizedEvent.severity === 'CRITICAL' && normalizeString(provider.officialLinkRegistryId)) {
        const messageDraft = buildEmergencyMessageDraft({
          severity: normalizedEvent.severity,
          category: normalizedEvent.category,
          regionKey,
          headline: normalizedEvent.headline
        });
        const bulletin = await emergencyBulletinsRepo.ensureDraftByDiff(diff.id, {
          providerKey,
          regionKey,
          category: normalizedEvent.category,
          severity: normalizedEvent.severity,
          linkRegistryId: normalizeString(provider.officialLinkRegistryId),
          messageDraft,
          headline: normalizedEvent.headline,
          evidenceRefs: {
            snapshotId: snapshot.id,
            eventDocId,
            diffId: diff.id
          },
          traceId
        });
        draftBulletinIds.push(bulletin.id);
      }
    }
  }

  for (const existing of existingEvents) {
    if (!existing || existing.isActive !== true) continue;
    if (seenEventDocIds.has(existing.id)) continue;

    await emergencyEventsRepo.upsertEvent(existing.id, {
      providerKey,
      eventKey: existing.eventKey,
      regionKey: existing.regionKey,
      severity: existing.severity,
      category: existing.category,
      startsAt: existing.startsAt || null,
      endsAt: existing.endsAt || null,
      headline: existing.headline,
      officialLinkRegistryId: existing.officialLinkRegistryId || null,
      snapshotId: snapshot.id,
      runId,
      traceId,
      eventHash: existing.eventHash,
      isActive: false,
      resolvedAt: now.toISOString(),
      rawMeta: existing.rawMeta || null
    });

    const diff = await emergencyDiffsRepo.createDiff({
      id: buildDiffDocId(runId, existing.id, 'resolve', snapshot.id, ['isActive', 'resolvedAt']),
      providerKey,
      regionKey: existing.regionKey,
      category: existing.category || 'alert',
      diffType: 'resolve',
      severity: normalizeSeverity(existing.severity),
      changedKeys: ['isActive', 'resolvedAt'],
      summaryDraft: null,
      snapshotId: snapshot.id,
      eventKey: existing.eventKey,
      eventDocId: existing.id,
      runId,
      traceId
    });
    diffIds.push(diff.id);
    resolvedCount += 1;
  }

  await appendEmergencyAudit({
    actor,
    action: 'emergency.provider.normalize.finish',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId,
    runId,
    payloadSummary: {
      providerKey,
      snapshotId: snapshot.id,
      parsedEvents: events.length,
      createdCount,
      updatedCount,
      resolvedCount,
      unmappedCount,
      diffCount: diffIds.length,
      draftBulletinCount: draftBulletinIds.length
    }
  }, deps);

  return {
    ok: true,
    providerKey,
    runId,
    traceId,
    snapshotId: snapshot.id,
    parsedEvents: events.length,
    createdCount,
    updatedCount,
    resolvedCount,
    unmappedCount,
    diffIds,
    draftBulletinIds: Array.from(new Set(draftBulletinIds))
  };
}

module.exports = {
  normalizeAndDiffProvider,
  buildEventDocId,
  buildEventHash
};
