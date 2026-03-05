'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildAssistantQualitySummary,
  buildGateAuditBaseline
} = require('../../src/routes/admin/osLlmUsageSummary');

test('phase720: assistant quality summary aggregates coverage and intent acceptance', () => {
  const rows = [
    {
      decision: 'allow',
      assistantQuality: {
        intentResolved: 'timeline_build',
        kbTopScore: 0.9,
        evidenceCoverage: 1,
        blockedStage: null,
        fallbackReason: null
      }
    },
    {
      decision: 'blocked',
      assistantQuality: {
        intentResolved: 'timeline_build',
        kbTopScore: 0.5,
        evidenceCoverage: 0.5,
        blockedStage: 'generation_guard',
        fallbackReason: 'citation_missing'
      }
    },
    {
      decision: 'blocked',
      assistantQuality: {
        intentResolved: 'risk_alert',
        kbTopScore: 0.7,
        evidenceCoverage: 1,
        blockedStage: 'snapshot_gate',
        fallbackReason: 'snapshot_stale'
      }
    }
  ];

  const summary = buildAssistantQualitySummary(rows);
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.avgKbTopScore, 0.7);
  assert.equal(summary.avgEvidenceCoverage, 0.8333);
  assert.equal(summary.blockedStages[0].blockedStage, 'none');
  assert.equal(summary.intents[0].intentResolved, 'timeline_build');
  assert.equal(summary.acceptedRateByIntent[0].intentResolved, 'timeline_build');
  assert.equal(summary.acceptedRateByIntent[0].acceptedRate, 0.5);
});

test('phase720: gate audit baseline reads blocked reasons and stages from payload summary', () => {
  const rows = [
    {
      payloadSummary: {
        decision: 'allow',
        blockedReason: null,
        assistantQuality: { blockedStage: null },
        entryType: 'webhook',
        gatesApplied: ['kill_switch', 'url_guard']
      }
    },
    {
      payloadSummary: {
        decision: 'blocked',
        blockedReason: 'citation_missing',
        assistantQuality: { blockedStage: 'generation_guard' },
        entryType: 'admin',
        gatesApplied: ['kill_switch']
      }
    },
    {
      payloadSummary: {
        decision: 'blocked',
        blockedReason: 'snapshot_stale',
        assistantQuality: { blockedStage: 'snapshot_gate' },
        entryType: 'compat',
        gatesApplied: ['kill_switch', 'injection']
      }
    }
  ];

  const baseline = buildGateAuditBaseline(rows);
  assert.equal(baseline.callsTotal, 3);
  assert.equal(baseline.blockedCount, 2);
  assert.equal(baseline.acceptedRate, 0.3333);
  assert.equal(baseline.blockedReasons.length, 2);
  assert.equal(baseline.blockedStages.length, 2);
  assert.equal(baseline.entryTypes.length, 3);
  assert.equal(baseline.gatesCoverage.length, 3);
});
