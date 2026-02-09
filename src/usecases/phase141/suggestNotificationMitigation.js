'use strict';

function normalizeHealth(value) {
  if (value === 'DANGER' || value === 'WARN' || value === 'OK') return value;
  return 'UNKNOWN';
}

function worstHealth(items) {
  let worst = 'OK';
  for (const item of items) {
    const h = normalizeHealth(item && item.health);
    if (h === 'DANGER') return 'DANGER';
    if (h === 'WARN') worst = 'WARN';
  }
  return worst;
}

function buildTargets(items) {
  const targets = Array.isArray(items) ? items.slice(0, 3) : [];
  return targets.map((item) => ({
    notificationId: item.notificationId || null,
    health: item.health || null,
    ctr: typeof item.ctr === 'number' ? item.ctr : null
  }));
}

function suggestNotificationMitigation(params) {
  const payload = params || {};
  const top = Array.isArray(payload.topUnhealthyNotifications) ? payload.topUnhealthyNotifications : [];
  const worst = worstHealth(top);
  if (worst !== 'DANGER' && worst !== 'WARN') return null;

  if (worst === 'DANGER') {
    return {
      actionType: 'PAUSE_AND_REVIEW',
      reason: 'notification ctr is below danger threshold (sent>=30, ctr<0.05)',
      recommended: true,
      allowed: ['NO_ACTION', 'PAUSE_AND_REVIEW'],
      requiredHumanCheck: true,
      targets: buildTargets(top)
    };
  }

  return {
    actionType: 'REVIEW_AND_ITERATE',
    reason: 'notification ctr is below warn threshold (sent>=30, ctr<0.15)',
    recommended: true,
    allowed: ['NO_ACTION', 'REVIEW_AND_ITERATE'],
    requiredHumanCheck: true,
    targets: buildTargets(top)
  };
}

module.exports = {
  suggestNotificationMitigation
};

