'use strict';

const SNAPSHOT_MODE_PREFER = 'prefer';
const SNAPSHOT_MODE_REQUIRE = 'require';
const SNAPSHOT_MODE_DISABLED = 'disabled';

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

module.exports = {
  SNAPSHOT_MODE_PREFER,
  SNAPSHOT_MODE_REQUIRE,
  SNAPSHOT_MODE_DISABLED,
  normalizeSnapshotMode,
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed
};
