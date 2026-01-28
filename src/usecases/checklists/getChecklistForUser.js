'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const checklistsRepo = require('../../repos/firestore/checklistsRepo');

async function getChecklistForUser(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const user = await usersRepo.getUser(payload.lineUserId);
  if (!user || !user.scenario) {
    console.warn('[phase1] checklist skipped: missing user scenario');
    return { scenario: null, step: payload.step || null, checklists: [] };
  }
  if (!payload.step) {
    console.warn('[phase1] checklist skipped: missing step');
    return { scenario: user.scenario, step: null, checklists: [] };
  }
  const list = await checklistsRepo.listChecklists({
    scenario: user.scenario,
    step: payload.step,
    limit: payload.limit
  });
  return { scenario: user.scenario, step: payload.step, checklists: list };
}

module.exports = {
  getChecklistForUser
};
