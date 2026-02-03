'use strict';

const phase18StatsRepo = require('../../repos/firestore/phase18StatsRepo');

function isEnabled() {
  return process.env.PHASE18_CTA_EXPERIMENT === '1';
}

async function recordSent(params) {
  if (!isEnabled()) return false;
  await phase18StatsRepo.incrementSent(params);
  return true;
}

async function recordClick(params) {
  if (!isEnabled()) return false;
  await phase18StatsRepo.incrementClick(params);
  return true;
}

module.exports = {
  recordSent,
  recordClick
};
