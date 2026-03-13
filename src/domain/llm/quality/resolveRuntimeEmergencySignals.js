'use strict';

const usersRepo = require('../../../repos/firestore/usersRepo');
const emergencyEventsRepo = require('../../../repos/firestore/emergencyEventsRepo');
const linkRegistryRepo = require('../../../repos/firestore/linkRegistryRepo');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeRegionKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
}

function resolveSeverityRank(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'CRITICAL') return 3;
  if (normalized === 'WARN') return 2;
  if (normalized === 'INFO') return 1;
  return 0;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRegionKeyFromSnapshot(snapshot) {
  const payload = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const location = payload.location && typeof payload.location === 'object' ? payload.location : {};
  return normalizeRegionKey(payload.regionKey || location.regionKey || location.state);
}

function isOfficialLink(link) {
  if (!link || typeof link !== 'object') return false;
  if (typeof link.url !== 'string' || !link.url.trim()) return false;
  const domainClass = normalizeText(link.domainClass).toLowerCase();
  return domainClass === 'gov' || domainClass === 'k12_district' || domainClass === 'school_public';
}

async function resolveRuntimeEmergencySignals(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const getUser = resolvedDeps.getUser || usersRepo.getUser;
  const listEventsByRegion = resolvedDeps.listEventsByRegion || emergencyEventsRepo.listEventsByRegion;
  const getLink = resolvedDeps.getLink || linkRegistryRepo.getLink;

  const nested = payload.emergencyContext && typeof payload.emergencyContext === 'object'
    ? payload.emergencyContext
    : null;
  const explicitActive = payload.emergencyContext === true
    || payload.emergencyContextActive === true
    || (nested && nested.active === true);
  if (explicitActive) {
    return {
      emergencyContext: true,
      emergencySeverity: normalizeText(payload.emergencySeverity || (nested && nested.severity)).toUpperCase() || 'WARN',
      emergencyOfficialSourceSatisfied: payload.emergencyOfficialSourceSatisfied === true
        || (nested && nested.officialSourceSatisfied === true),
      emergencyOverrideApplied: payload.emergencyOverrideApplied !== false,
      emergencyRegionKey: normalizeRegionKey(payload.regionKey) || resolveRegionKeyFromSnapshot(payload.contextSnapshot),
      emergencyEventId: normalizeText(payload.emergencyEventId || (nested && nested.eventId)) || null,
      emergencySourceSnapshot: payload.emergencySourceSnapshot && typeof payload.emergencySourceSnapshot === 'object'
        ? Object.assign({}, payload.emergencySourceSnapshot)
        : null
    };
  }

  let regionKey = normalizeRegionKey(payload.regionKey) || resolveRegionKeyFromSnapshot(payload.contextSnapshot);
  if (!regionKey && lineUserId) {
    const user = await getUser(lineUserId).catch(() => null);
    regionKey = normalizeRegionKey(user && user.regionKey);
  }
  if (!regionKey) {
    return {
      emergencyContext: false,
      emergencySeverity: null,
      emergencyOfficialSourceSatisfied: false,
      emergencyOverrideApplied: false,
      emergencyRegionKey: null,
      emergencyEventId: null,
      emergencySourceSnapshot: null
    };
  }

  const rows = await listEventsByRegion(regionKey, 20).catch(() => []);
  const activeRows = rows
    .filter((item) => item && item.isActive === true)
    .sort((left, right) => {
      const severityDelta = resolveSeverityRank(right && right.severity) - resolveSeverityRank(left && left.severity);
      if (severityDelta !== 0) return severityDelta;
      return toMillis(right && right.updatedAt) - toMillis(left && left.updatedAt);
    });
  const event = activeRows[0] || null;
  if (!event) {
    return {
      emergencyContext: false,
      emergencySeverity: null,
      emergencyOfficialSourceSatisfied: false,
      emergencyOverrideApplied: false,
      emergencyRegionKey: regionKey,
      emergencyEventId: null,
      emergencySourceSnapshot: null
    };
  }

  const link = event.officialLinkRegistryId
    ? await getLink(event.officialLinkRegistryId).catch(() => null)
    : null;

  return {
    emergencyContext: true,
    emergencySeverity: normalizeText(event.severity).toUpperCase() || 'WARN',
    emergencyOfficialSourceSatisfied: isOfficialLink(link),
    emergencyOverrideApplied: true,
    emergencyRegionKey: regionKey,
    emergencyEventId: event.id || null,
    emergencySourceSnapshot: {
      eventId: event.id || null,
      regionKey,
      severity: normalizeText(event.severity).toUpperCase() || 'WARN',
      officialLinkRegistryId: normalizeText(event.officialLinkRegistryId) || null,
      officialSourceSatisfied: isOfficialLink(link)
    }
  };
}

module.exports = {
  resolveRuntimeEmergencySignals
};
