'use strict';

const phase18StatsRepo = require('../../repos/firestore/phase18StatsRepo');

function isEnabled() {
  // Phase20: member-track service must record CTA stats for unauth click flow.
  // This does not affect the private member service because SERVICE_MODE differs.
  if (process.env.SERVICE_MODE === 'track') return true;
  if (process.env.SERVICE_MODE === 'member') return true;
  if (process.env.PHASE18_CTA_EXPERIMENT === '1') return true;
  // Phase21: enable sent stats in stg even when the experiment flag is unset.
  if (process.env.ENV_NAME === 'stg') return true;
  return false;
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
