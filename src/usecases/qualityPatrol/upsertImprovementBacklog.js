'use strict';

const improvementBacklogRepo = require('../../repos/firestore/improvementBacklogRepo');
const { buildBacklogRecord } = require('../../domain/qualityPatrol/buildBacklogRecord');

async function upsertImprovementBacklog(params, deps) {
  const repo = deps && deps.improvementBacklogRepo
    ? deps.improvementBacklogRepo
    : improvementBacklogRepo;
  const record = buildBacklogRecord(params);
  const result = await repo.upsertImprovementBacklog(record);
  return Object.assign({ backlog: record }, result);
}

module.exports = {
  upsertImprovementBacklog
};
