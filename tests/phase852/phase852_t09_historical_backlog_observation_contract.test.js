'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRootCauseReport } = require('../../src/domain/qualityPatrol/rootCause/buildRootCauseReport');

test('phase852: historical-only observation issues stay analyzable even when old blocker evidence is present', () => {
  const result = buildRootCauseReport({
    issue: {
      issueKey: 'issue_historical_observation_gap',
      issueType: 'observation_blocker',
      historicalOnly: true,
      metricKey: 'observationBlockerRate',
      metricStatus: 'warn',
      category: 'observation_blocker_rate_high',
      slice: 'global',
      supportingEvidence: [{
        metricKey: 'observationBlockerRate',
        metricStatus: 'warn',
        summary: 'observationBlockerRate:global:warn:0.19',
        slice: 'global',
        value: 0.19,
        sampleCount: 100
      }]
    },
    kpiResult: {
      metrics: {
        observationBlockerRate: {
          status: 'warn',
          value: 0.19,
          sampleCount: 100,
          sourceCollections: ['conversation_review_snapshots'],
          observationBlockers: [{
            code: 'missing_user_message',
            severity: 'high',
            message: 'Masked user message snapshot is unavailable.',
            source: 'conversation_review_snapshots'
          }]
        }
      }
    },
    reviewUnits: [{
      reviewUnitId: 'review_unit_historical_gap',
      slice: 'other',
      sourceCollections: ['conversation_review_snapshots'],
      evidenceRefs: [],
      telemetrySignals: {},
      observationBlockers: [{
        code: 'missing_user_message',
        severity: 'high',
        message: 'Masked user message snapshot is unavailable.',
        source: 'conversation_review_snapshots'
      }]
    }]
  });

  assert.equal(result.analysisStatus, 'analyzed');
  assert.equal(result.historicalOnly, true);
  assert.equal(result.causeCandidates[0].causeType, 'observation_gap');
});
