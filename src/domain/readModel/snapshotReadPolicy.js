'use strict';

const SNAPSHOT_MODE_PREFER = 'prefer';
const SNAPSHOT_MODE_REQUIRE = 'require';
const SNAPSHOT_MODE_DISABLED = 'disabled';
const DEFAULT_SNAPSHOT_FRESHNESS_MINUTES = 60;
const MAX_SNAPSHOT_FRESHNESS_MINUTES = 1440;

function normalizeSnapshotMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === SNAPSHOT_MODE_PREFER) return SNAPSHOT_MODE_PREFER;
  if (normalized === SNAPSHOT_MODE_REQUIRE) return SNAPSHOT_MODE_REQUIRE;
  if (normalized === SNAPSHOT_MODE_DISABLED) return SNAPSHOT_MODE_DISABLED;
  return null;
}

function resolveSnapshotReadMode(options) {
  const payload = options && typeof options === 'object' ? options : {};

  if (payload.useSnapshot === false) return SNAPSHOT_MODE_DISABLED;

  const explicitMode = normalizeSnapshotMode(payload.snapshotMode);
  if (explicitMode) return explicitMode;

  const envMode = normalizeSnapshotMode(process.env.OPS_SNAPSHOT_MODE);
  if (envMode) return envMode;

  const legacyEnv = process.env.OPS_SNAPSHOT_READ_ENABLED;
  if (legacyEnv === '0' || legacyEnv === 'false') return SNAPSHOT_MODE_DISABLED;

  return SNAPSHOT_MODE_PREFER;
}

function isSnapshotReadEnabled(mode) {
  return mode !== SNAPSHOT_MODE_DISABLED;
}

function isSnapshotRequired(mode) {
  return mode === SNAPSHOT_MODE_REQUIRE;
}

function isFallbackAllowed(mode) {
  return mode === SNAPSHOT_MODE_PREFER || mode === SNAPSHOT_MODE_DISABLED;
}

function resolveSnapshotFreshnessMinutes(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const explicit = Number(payload.freshnessMinutes);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(Math.floor(explicit), MAX_SNAPSHOT_FRESHNESS_MINUTES);
  }
  const envValue = Number(process.env.OPS_SNAPSHOT_FRESHNESS_MINUTES);
  if (Number.isFinite(envValue) && envValue > 0) {
    return Math.min(Math.floor(envValue), MAX_SNAPSHOT_FRESHNESS_MINUTES);
  }
  return DEFAULT_SNAPSHOT_FRESHNESS_MINUTES;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (value && Number.isFinite(value._seconds)) return Number(value._seconds) * 1000;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return null;
}

function isSnapshotFresh(snapshot, freshnessMinutes) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const asOfMs = toMillis(snapshot.asOf);
  // Backward compatibility: older snapshots without asOf are treated as fresh.
  if (!Number.isFinite(asOfMs)) return true;
  const freshness = resolveSnapshotFreshnessMinutes({ freshnessMinutes });
  return Date.now() - asOfMs <= freshness * 60 * 1000;
}

module.exports = {
  SNAPSHOT_MODE_PREFER,
  SNAPSHOT_MODE_REQUIRE,
  SNAPSHOT_MODE_DISABLED,
  DEFAULT_SNAPSHOT_FRESHNESS_MINUTES,
  normalizeSnapshotMode,
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed,
  resolveSnapshotFreshnessMinutes,
  isSnapshotFresh
};
