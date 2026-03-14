'use strict';

const improvementBacklogRepo = require('../../repos/firestore/improvementBacklogRepo');

async function listTopPriorityBacklog(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const repo = deps && deps.improvementBacklogRepo
    ? deps.improvementBacklogRepo
    : improvementBacklogRepo;
  return repo.listImprovementBacklog({
    limit: payload.limit,
    statuses: payload.statuses || ['proposed', 'approved', 'in_progress']
  });
}

module.exports = {
  listTopPriorityBacklog
};
