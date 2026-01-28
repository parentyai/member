'use strict';

const userChecklistsRepo = require('../../repos/firestore/userChecklistsRepo');
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

  if (!base.checklists || base.checklists.length === 0) {
    return { scenario: base.scenario, step: base.step, items: [] };
  }

  const completedEntries = await userChecklistsRepo.listUserChecklists({
    lineUserId: payload.lineUserId,
    limit: payload.limit
  });
  const completionMap = buildCompletionMap(completedEntries);

  const items = [];
  for (const checklist of base.checklists) {
    const list = Array.isArray(checklist.items) ? checklist.items : [];
    for (const item of list) {
      const docId = `${payload.lineUserId}__${checklist.id}__${item.itemId}`;
      items.push({
        checklistId: checklist.id,
        itemId: item.itemId,
        title: item.title,
        linkRegistryId: item.linkRegistryId,
        order: item.order,
        completedAt: completionMap.has(docId) ? completionMap.get(docId) : null
      });
    }
  }

  return { scenario: base.scenario, step: base.step, items };
}

module.exports = {
  getChecklistWithStatus
};
