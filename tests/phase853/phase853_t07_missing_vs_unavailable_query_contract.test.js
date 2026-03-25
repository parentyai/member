'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

test('phase853: query keeps unavailable separate from insufficient evidence', () => {
  const unavailable = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['conversation_review_snapshots'] }],
    metrics: {},
    kpiSummary: { overallStatus: 'unavailable' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'planned'
  });

  const insufficient = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [],
    metrics: {},
    kpiSummary: { overallStatus: 'unavailable' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'insufficient_evidence'
  });

  assert.equal(unavailable.summary.overallStatus, 'unavailable');
  assert.equal(unavailable.observationStatus, 'unavailable');
  assert.equal(insufficient.summary.overallStatus, 'insufficient_evidence');
  assert.equal(insufficient.observationStatus, 'insufficient_evidence');
  assert.equal(insufficient.evidenceAvailability.status, 'organic_current_runtime_unavailable');
  assert.equal(unavailable.evidenceAvailability.status, 'available');
  assert.ok(insufficient.summary.topFindings[0].includes('organic current runtime evidence'));
  assert.equal(unavailable.summary.topFindings.length, 0);
});
