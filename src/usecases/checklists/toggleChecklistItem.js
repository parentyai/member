'use strict';

const { serverTimestamp } = require('../../infra/firestore');
const userChecklistsRepo = require('../../repos/firestore/userChecklistsRepo');
const { logEventBestEffort } = require('../events/logEvent');

async function toggleChecklistItem(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.checklistId) throw new Error('checklistId required');
  if (!payload.itemId) throw new Error('itemId required');

  const completedAt = payload.complete ? serverTimestamp() : null;
  const updated = await userChecklistsRepo.upsertUserChecklist({
    lineUserId: payload.lineUserId,
    checklistId: payload.checklistId,
    itemId: payload.itemId,
    completedAt
  });

  if (payload.complete) {
    await logEventBestEffort({
      lineUserId: payload.lineUserId,
      type: 'complete',
      ref: {
        checklistId: payload.checklistId,
        itemId: payload.itemId
      }
    });
  }

  return { id: updated.id, completedAt };
}

module.exports = {
  toggleChecklistItem
};
