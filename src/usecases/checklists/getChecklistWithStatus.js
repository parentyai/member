// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const userChecklistsRepo = require('../../repos/firestore/userChecklistsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { getChecklistForUser } = require('./getChecklistForUser');

function buildCompletionMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(entry.id, entry.completedAt || null);
  }
  return map;
}

async function getChecklistWithStatus(params) {
  const payload = params || {};
  const base = await getChecklistForUser({
    lineUserId: payload.lineUserId,
    step: payload.step,
    limit: payload.limit
  });
  const scenarioKey = base && typeof base === 'object' ? (base.scenarioKey || base.scenario || null) : null;

  if (!base.checklists || base.checklists.length === 0) {
    return { scenarioKey, scenario: base.scenario, step: base.step, items: [] };
  }

  const completedEntries = await userChecklistsRepo.listUserChecklists({
    lineUserId: payload.lineUserId,
    limit: payload.limit
  });
  const completionMap = buildCompletionMap(completedEntries);
  const user = await usersRepo.getUser(payload.lineUserId);
  const checklistDone = user && user.checklistDone && typeof user.checklistDone === 'object'
    ? user.checklistDone
    : {};

  const items = [];
  for (const checklist of base.checklists) {
    const list = Array.isArray(checklist.items) ? checklist.items : [];
    for (const item of list) {
      const docId = `${payload.lineUserId}__${checklist.id}__${item.itemId}`;
      const done = checklistDone[item.itemId] === true;
      const completedAt = completionMap.has(docId) ? completionMap.get(docId) : (done ? 'DONE' : null);
      items.push({
        checklistId: checklist.id,
        itemId: item.itemId,
        title: item.title,
        linkRegistryId: item.linkRegistryId,
        order: item.order,
        completedAt
      });
    }
  }

  return { scenarioKey, scenario: base.scenario, step: base.step, items };
}

module.exports = {
  getChecklistWithStatus
};
