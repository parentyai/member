'use strict';

const qualityIssueRegistryRepo = require('../../repos/firestore/qualityIssueRegistryRepo');
const { buildIssueRecord } = require('../../domain/qualityPatrol/buildIssueRecord');

async function upsertQualityIssue(params, deps) {
  const repo = deps && deps.qualityIssueRegistryRepo
    ? deps.qualityIssueRegistryRepo
    : qualityIssueRegistryRepo;
  const record = buildIssueRecord(params);
  const result = await repo.upsertQualityIssue(record);
  return Object.assign({ issue: record }, result);
}

module.exports = {
  upsertQualityIssue
};
