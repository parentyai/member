'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLower(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
}

function normalizeSnake(value) {
  const normalized = normalizeLower(value);
  return normalized ? normalized.replace(/\s+/g, '_') : null;
}

function resolveRouteKind(entryType, routeKind) {
  const explicit = normalizeLower(routeKind);
  if (explicit === 'canonical' || explicit === 'compat') return explicit;
  const normalizedEntryType = normalizeLower(entryType);
  return normalizedEntryType === 'compat' ? 'compat' : 'canonical';
}

function resolveRouteDecisionSource(entryType, routeDecisionSource, routerReason) {
  const explicit = normalizeSnake(routeDecisionSource);
  if (explicit) return explicit;
  const normalizedEntryType = normalizeLower(entryType);
  if (normalizedEntryType === 'compat') return 'compat_route';
  if (normalizedEntryType === 'admin') return 'admin_route';
  if (normalizedEntryType === 'job') return 'job_route';
  return normalizeSnake(routerReason) ? 'conversation_router' : 'webhook_route';
}

function resolveRouteCoverageMeta(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const entryType = normalizeLower(payload.entryType) || 'unknown';
  const routerReason = normalizeSnake(payload.routerReason);
  const fallbackType = normalizeSnake(payload.fallbackType);
  const compatFallbackReason = normalizeSnake(payload.compatFallbackReason);
  const sharedReadinessBridge = normalizeSnake(payload.sharedReadinessBridge);

  return {
    routeKind: resolveRouteKind(entryType, payload.routeKind),
    routerReason,
    routerReasonObserved: routerReason !== null,
    fallbackType,
    compatFallbackReason,
    sharedReadinessBridge,
    sharedReadinessBridgeObserved: sharedReadinessBridge !== null,
    routeDecisionSource: resolveRouteDecisionSource(entryType, payload.routeDecisionSource, routerReason)
  };
}

module.exports = {
  resolveRouteCoverageMeta
};
