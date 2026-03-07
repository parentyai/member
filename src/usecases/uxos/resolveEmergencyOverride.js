'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const {
  isUxosEmergencyOverrideEnabled,
  getUxosEmergencyOverrideScanLimit,
  getUxosEmergencyOverrideMaxAgeHours
} = require('../../domain/uxos/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime();
}

function resolveReferenceAt(row) {
  const payload = row && typeof row === 'object' ? row : {};
  return payload.sentAt || payload.updatedAt || payload.createdAt || null;
}

function resolveRegionKey(user) {
  const row = user && typeof user === 'object' ? user : {};
  const regionKey = normalizeText(row.regionKey || row.targetRegionKey || row.region);
  return regionKey.toLowerCase();
}

function toRecommendation(item) {
  const row = item && typeof item === 'object' ? item : {};
  return {
    action: 'CHECK_EMERGENCY_ALERT',
    reason: 'emergency_override_active',
    confidence: 0.99,
    emergency: {
      bulletinId: row.id || null,
      regionKey: row.regionKey || null,
      severity: row.severity || null,
      category: row.category || null,
      headline: row.headline || null,
      sentAt: row.sentAt || null
    }
  };
}

async function resolveEmergencyOverride(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');

  if (!isUxosEmergencyOverrideEnabled()) {
    return {
      ok: true,
      enabled: false,
      active: false,
      lineUserId,
      reason: 'disabled_by_flag',
      recommendation: null
    };
  }

  const scanLimit = getUxosEmergencyOverrideScanLimit();
  const maxAgeHours = getUxosEmergencyOverrideMaxAgeHours();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const nowMs = toMillis(payload.now || new Date().toISOString());

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const users = resolvedDeps.usersRepo && typeof resolvedDeps.usersRepo.getUser === 'function'
    ? resolvedDeps.usersRepo
    : usersRepo;
  const bulletins = resolvedDeps.emergencyBulletinsRepo && typeof resolvedDeps.emergencyBulletinsRepo.listBulletins === 'function'
    ? resolvedDeps.emergencyBulletinsRepo
    : emergencyBulletinsRepo;

  const user = await users.getUser(lineUserId).catch(() => null);
  const regionKey = resolveRegionKey(user);
  if (!regionKey) {
    return {
      ok: true,
      enabled: true,
      active: false,
      lineUserId,
      reason: 'region_key_missing',
      regionKey: null,
      recommendation: null
    };
  }

  const rows = await bulletins.listBulletins({
    status: 'sent',
    limit: scanLimit
  }).catch(() => []);

  const candidates = (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const bulletinRegion = normalizeText(row && row.regionKey).toLowerCase();
      return bulletinRegion && bulletinRegion === regionKey;
    })
    .sort((a, b) => toMillis(resolveReferenceAt(b)) - toMillis(resolveReferenceAt(a)));

  const latest = candidates.length > 0 ? candidates[0] : null;
  if (!latest) {
    return {
      ok: true,
      enabled: true,
      active: false,
      lineUserId,
      reason: 'no_recent_sent_bulletin',
      regionKey,
      recommendation: null
    };
  }

  const referenceAt = resolveReferenceAt(latest);
  const referenceMs = toMillis(referenceAt);
  if (!referenceMs || (nowMs > 0 && referenceMs + maxAgeMs < nowMs)) {
    return {
      ok: true,
      enabled: true,
      active: false,
      lineUserId,
      reason: 'latest_bulletin_stale',
      regionKey,
      recommendation: null
    };
  }

  return {
    ok: true,
    enabled: true,
    active: true,
    lineUserId,
    reason: 'emergency_override_active',
    regionKey,
    recommendation: toRecommendation(latest),
    debug: {
      bulletinId: latest.id || null,
      maxAgeHours,
      scannedCount: Array.isArray(rows) ? rows.length : 0
    }
  };
}

module.exports = {
  resolveEmergencyOverride
};
