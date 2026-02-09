'use strict';

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function rankTrueFirst(value) {
  return value === true ? 0 : 1;
}

function rankNotReady(item) {
  const status = item && item.readiness && item.readiness.status;
  return status === 'NOT_READY' ? 0 : 1;
}

function rankNextAction(item) {
  const nextAction = item && item.opsState && item.opsState.nextAction;
  return nextAction && nextAction !== 'NO_ACTION' ? 0 : 1;
}

function compareLastActionAtDesc(a, b) {
  const aMs = toMillis(a && a.lastActionAt);
  const bMs = toMillis(b && b.lastActionAt);
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  if (aMs === bMs) return 0;
  return aMs > bMs ? -1 : 1;
}

function compareLineUserIdAsc(a, b) {
  const aId = a && typeof a.lineUserId === 'string' ? a.lineUserId : '';
  const bId = b && typeof b.lineUserId === 'string' ? b.lineUserId : '';
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}

function sortUsersSummaryStable(items) {
  const input = Array.isArray(items) ? items.slice() : [];
  const indexed = input.map((item, idx) => ({ item, idx }));
  indexed.sort((left, right) => {
    const a = left.item;
    const b = right.item;

    const ranks = [
      rankTrueFirst(a && a.needsAttention) - rankTrueFirst(b && b.needsAttention),
      rankNotReady(a) - rankNotReady(b),
      rankNextAction(a) - rankNextAction(b),
      rankTrueFirst(a && a.stale) - rankTrueFirst(b && b.stale)
    ];
    for (const diff of ranks) {
      if (diff !== 0) return diff;
    }

    const lastActionDiff = compareLastActionAtDesc(a, b);
    if (lastActionDiff !== 0) return lastActionDiff;

    const idDiff = compareLineUserIdAsc(a, b);
    if (idDiff !== 0) return idDiff;

    return left.idx - right.idx;
  });
  return indexed.map((entry) => entry.item);
}

module.exports = {
  sortUsersSummaryStable
};

