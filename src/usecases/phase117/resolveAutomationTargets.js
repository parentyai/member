'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const { listNotifications } = require('../notifications/listNotifications');

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

async function resolveAutomationTargets(params, deps) {
  const payload = params || {};
  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const listFn = deps && deps.listNotifications ? deps.listNotifications : listNotifications;

  const config = payload.config || await configRepo.getLatestAutomationConfig();
  const targetStatus = (config && typeof config.targetNotificationStatus === 'string')
    ? config.targetNotificationStatus
    : 'active';
  const scenarioKeys = normalizeStringArray(config && config.targetScenarioKeys);
  const stepKeys = normalizeStringArray(config && config.targetStepKeys);

  const notifications = await listFn({ status: targetStatus, limit: 200 });
  const filtered = (notifications || []).filter((item) => {
    if (!item) return false;
    if (scenarioKeys.length && !scenarioKeys.includes(item.scenarioKey)) return false;
    if (stepKeys.length && !stepKeys.includes(item.stepKey)) return false;
    return true;
  });

  return filtered.map((item) => ({
    notificationId: item.id,
    scenarioKey: item.scenarioKey || null,
    stepKey: item.stepKey || null,
    createdAt: item.createdAt || null
  }));
}

module.exports = {
  resolveAutomationTargets
};
