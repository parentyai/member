'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { SCENARIO_KEYS, STEP_KEYS } = require('../../domain/constants');

async function ensureUserFromWebhook(lineUserId) {
  if (!lineUserId) throw new Error('lineUserId required');
  const existing = await usersRepo.getUser(lineUserId);
  if (existing) {
    return { id: lineUserId, created: false };
  }
  const data = {
    scenarioKey: SCENARIO_KEYS.A,
    stepKey: STEP_KEYS.THREE_MONTHS,
    memberNumber: null,
    memberCardAsset: null
  };
  await usersRepo.createUser(lineUserId, data);
  return { id: lineUserId, created: true };
}

module.exports = {
  ensureUserFromWebhook
};
