'use strict';

const qualityIssueRegistryRepo = require('../../repos/firestore/qualityIssueRegistryRepo');

async function listOpenIssues(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const repo = deps && deps.qualityIssueRegistryRepo
    ? deps.qualityIssueRegistryRepo
    : qualityIssueRegistryRepo;
  const statuses = payload.includeWatching === false ? ['open'] : ['open', 'watching'];
  return repo.listQualityIssues({
    limit: payload.limit,
    layer: payload.layer,
    slice: payload.slice,
    statuses
  });
}

module.exports = {
  listOpenIssues
};
