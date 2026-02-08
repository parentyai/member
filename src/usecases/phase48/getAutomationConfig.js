'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');

async function getAutomationConfig(params, deps) {
  const repo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const latest = await repo.getLatestAutomationConfig();
  const config = repo.normalizePhase48Config(latest);
  return {
    ok: true,
    config
  };
}

module.exports = {
  getAutomationConfig
};
