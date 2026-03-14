'use strict';

const { buildImprovementPlan } = require('./planning/buildImprovementPlan');
const { IMPROVEMENT_PLANNER_PROVENANCE } = require('./planning/constants');

function mergeSourceCollections() {
  const out = [];
  Array.from(arguments).forEach((input) => {
    (Array.isArray(input) ? input : []).forEach((item) => {
      if (typeof item === 'string' && item.trim()) out.push(item.trim());
    });
  });
  return Array.from(new Set(out)).sort((left, right) => left.localeCompare(right, 'ja'));
}

function planImprovements(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const rootCauseResult = payload.rootCauseResult && typeof payload.rootCauseResult === 'object' ? payload.rootCauseResult : {};
  const rootCauseReports = Array.isArray(rootCauseResult.rootCauseReports) ? rootCauseResult.rootCauseReports : [];
  const plan = buildImprovementPlan({
    rootCauseReports,
    generatedAt: payload.generatedAt
  });
  return Object.assign({}, plan, {
    sourceCollections: mergeSourceCollections(
      rootCauseResult.sourceCollections,
      rootCauseReports.flatMap((item) => Array.isArray(item && item.sourceCollections) ? item.sourceCollections : [])
    ),
    provenance: IMPROVEMENT_PLANNER_PROVENANCE
  });
}

module.exports = {
  planImprovements
};
