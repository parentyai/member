'use strict';

const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const emergencySnapshotsRepo = require('../../repos/firestore/emergencySnapshotsRepo');
const emergencyDiffsRepo = require('../../repos/firestore/emergencyDiffsRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const emergencyUnmappedEventsRepo = require('../../repos/firestore/emergencyUnmappedEventsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { ensureEmergencyProviders } = require('./ensureEmergencyProviders');

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeLimit(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

async function listEmergencyProviders(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const providersRepo = deps && deps.emergencyProvidersRepo ? deps.emergencyProvidersRepo : emergencyProvidersRepo;
  const ensure = deps && deps.ensureEmergencyProviders ? deps.ensureEmergencyProviders : ensureEmergencyProviders;
  await ensure({ traceId: payload.traceId || null });
  const items = await providersRepo.listProviders(200);
  return {
    ok: true,
    traceId: payload.traceId || null,
    items
  };
}

async function updateEmergencyProvider(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const providerKey = typeof payload.providerKey === 'string' ? payload.providerKey.trim().toLowerCase() : '';
  if (!providerKey) throw createHttpError(400, 'providerKey required');

  const providersRepo = deps && deps.emergencyProvidersRepo ? deps.emergencyProvidersRepo : emergencyProvidersRepo;
  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const existing = await providersRepo.getProvider(providerKey);
  if (!existing) throw createHttpError(404, 'provider not found');

  await providersRepo.upsertProvider(providerKey, {
    status: payload.status,
    scheduleMinutes: payload.scheduleMinutes,
    officialLinkRegistryId: payload.officialLinkRegistryId,
    traceId: payload.traceId || null
  });
  const item = await providersRepo.getProvider(providerKey);

  await audit({
    actor: payload.actor || 'unknown',
    action: 'emergency.provider.update',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      status: item && item.status ? item.status : null,
      scheduleMinutes: item && Number(item.scheduleMinutes) ? Number(item.scheduleMinutes) : null
    }
  });

  return {
    ok: true,
    traceId: payload.traceId || null,
    item
  };
}

async function listEmergencyBulletins(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinsRepo = deps && deps.emergencyBulletinsRepo ? deps.emergencyBulletinsRepo : emergencyBulletinsRepo;
  const items = await bulletinsRepo.listBulletins({
    status: typeof payload.status === 'string' && payload.status.trim() ? payload.status.trim() : null,
    regionKey: typeof payload.regionKey === 'string' && payload.regionKey.trim() ? payload.regionKey.trim() : null,
    limit: normalizeLimit(payload.limit, 50, 200)
  });
  return {
    ok: true,
    traceId: payload.traceId || null,
    items
  };
}

async function getEmergencyBulletin(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinId = typeof payload.bulletinId === 'string' ? payload.bulletinId.trim() : '';
  if (!bulletinId) throw createHttpError(400, 'bulletinId required');

  const bulletinsRepo = deps && deps.emergencyBulletinsRepo ? deps.emergencyBulletinsRepo : emergencyBulletinsRepo;
  const item = await bulletinsRepo.getBulletin(bulletinId);
  if (!item) throw createHttpError(404, 'bulletin not found');

  return {
    ok: true,
    traceId: payload.traceId || null,
    item
  };
}

async function rejectEmergencyBulletin(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinId = typeof payload.bulletinId === 'string' ? payload.bulletinId.trim() : '';
  if (!bulletinId) throw createHttpError(400, 'bulletinId required');

  const bulletinsRepo = deps && deps.emergencyBulletinsRepo ? deps.emergencyBulletinsRepo : emergencyBulletinsRepo;
  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const bulletin = await bulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) throw createHttpError(404, 'bulletin not found');
  if (bulletin.status === 'sent') throw createHttpError(409, 'bulletin_already_sent');

  await bulletinsRepo.updateBulletin(bulletinId, {
    status: 'rejected',
    traceId: payload.traceId || null
  });
  await audit({
    actor: payload.actor || 'unknown',
    action: 'emergency.bulletin.reject',
    entityType: 'emergency_bulletin',
    entityId: bulletinId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      regionKey: bulletin.regionKey || null,
      severity: bulletin.severity || null
    }
  });

  return {
    ok: true,
    traceId: payload.traceId || null,
    bulletinId
  };
}

async function getEmergencyEvidence(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinId = typeof payload.bulletinId === 'string' ? payload.bulletinId.trim() : '';
  if (!bulletinId) throw createHttpError(400, 'bulletinId required');

  const bulletinsRepo = deps && deps.emergencyBulletinsRepo ? deps.emergencyBulletinsRepo : emergencyBulletinsRepo;
  const diffsRepo = deps && deps.emergencyDiffsRepo ? deps.emergencyDiffsRepo : emergencyDiffsRepo;
  const snapshotsRepo = deps && deps.emergencySnapshotsRepo ? deps.emergencySnapshotsRepo : emergencySnapshotsRepo;
  const unmappedRepo = deps && deps.emergencyUnmappedEventsRepo ? deps.emergencyUnmappedEventsRepo : emergencyUnmappedEventsRepo;
  const linksRepo = deps && deps.linkRegistryRepo ? deps.linkRegistryRepo : linkRegistryRepo;

  const bulletin = await bulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) throw createHttpError(404, 'bulletin not found');

  const refs = bulletin.evidenceRefs && typeof bulletin.evidenceRefs === 'object' ? bulletin.evidenceRefs : {};
  const diffId = refs.diffId || null;
  const snapshotId = refs.snapshotId || null;
  const diff = diffId ? await diffsRepo.getDiff(diffId).catch(() => null) : null;
  const resolvedSnapshotId = snapshotId || (diff && diff.snapshotId) || null;
  const snapshot = resolvedSnapshotId ? await snapshotsRepo.getSnapshot(resolvedSnapshotId).catch(() => null) : null;
  const unmappedEvents = resolvedSnapshotId
    ? await unmappedRepo.listUnmappedBySnapshot(resolvedSnapshotId, normalizeLimit(payload.unmappedLimit, 20, 100))
    : [];
  const linkEntry = bulletin.linkRegistryId
    ? await linksRepo.getLink(bulletin.linkRegistryId).catch(() => null)
    : null;

  return {
    ok: true,
    traceId: payload.traceId || null,
    item: {
      bulletin,
      diff,
      snapshot,
      unmappedEvents,
      linkEntry
    }
  };
}

module.exports = {
  listEmergencyProviders,
  updateEmergencyProvider,
  listEmergencyBulletins,
  getEmergencyBulletin,
  rejectEmergencyBulletin,
  getEmergencyEvidence
};
