'use strict';

const latestTimestampBySource = new Map();

function resolveSourceKey(event) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : {};
  return `${source.type || 'unknown'}:${source.userId || source.groupId || source.roomId || 'unknown'}`;
}

function shouldDropByOrdering(event, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const skewToleranceMs = Number.isFinite(Number(payload.skewToleranceMs))
    ? Math.max(0, Math.floor(Number(payload.skewToleranceMs)))
    : 20000;
  const timestamp = Number.isFinite(Number(event && event.timestamp)) ? Number(event.timestamp) : 0;
  if (!timestamp) return false;
  const sourceKey = resolveSourceKey(event);
  const latest = latestTimestampBySource.get(sourceKey) || 0;
  if (timestamp + skewToleranceMs < latest) {
    return true;
  }
  if (timestamp > latest) latestTimestampBySource.set(sourceKey, timestamp);
  return false;
}

function resetOrderingGuardState() {
  latestTimestampBySource.clear();
}

module.exports = {
  shouldDropByOrdering,
  resetOrderingGuardState
};
