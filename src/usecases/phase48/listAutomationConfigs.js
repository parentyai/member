// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');

async function listAutomationConfigs(params, deps) {
  const payload = params || {};
  const repo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const limit = typeof payload.limit === 'number' ? payload.limit : 20;
  const items = await repo.listAutomationConfigs(limit);
  const normalized = items.map((item) => Object.assign({ id: item.id }, repo.normalizePhase48Config(item)));
  return {
    ok: true,
    items: normalized
  };
}

module.exports = {
  listAutomationConfigs
};
