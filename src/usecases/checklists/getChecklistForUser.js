// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const checklistsRepo = require('../../repos/firestore/checklistsRepo');
const { normalizeScenarioKey } = require('../../domain/normalizers/scenarioKeyNormalizer');

async function getChecklistForUser(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const user = await usersRepo.getUser(payload.lineUserId);
  const scenarioKey = normalizeScenarioKey(user || {});
  if (!user || !scenarioKey) {
    console.warn('[phase1] checklist skipped: missing user scenario');
    return { scenarioKey: null, scenario: null, step: payload.step || null, checklists: [] };
  }
  if (!payload.step) {
    console.warn('[phase1] checklist skipped: missing step');
    return { scenarioKey, scenario: scenarioKey, step: null, checklists: [] };
  }
  const list = await checklistsRepo.listChecklists({
    scenario: scenarioKey,
    step: payload.step,
    limit: payload.limit
  });
  return { scenarioKey, scenario: scenarioKey, step: payload.step, checklists: list };
}

module.exports = {
  getChecklistForUser
};
