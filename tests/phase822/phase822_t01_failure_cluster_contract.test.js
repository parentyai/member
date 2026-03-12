'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildFailureClusters } = require('../../tools/run_llm_failure_cluster');

test('phase822: failure clusters are limited to supported categories with evidence and candidate files', () => {
  const report = buildFailureClusters({
    rootDir: process.cwd(),
    audit: {
      kpis: {
        contradictionRate: { status: 'fail', sampleCount: 10 },
        cityPackGroundingRate: { status: 'fail', sampleCount: 4 },
        traceJoinCompleteness: { status: 'missing', sampleCount: 0 },
        compatShareWindow: { status: 'warning', sampleCount: 12 }
      }
    },
    scan: {
      dimensions: {
        readinessIntegration: {
          status: 'partial',
          evidence: ['file:/tmp/example.js:12'],
          gaps: ['missing_readiness_evaluator']
        },
        knowledgeIntegration: {
          status: 'partial',
          evidence: ['file:/tmp/knowledge.js:4'],
          gaps: ['missing_saved_faq_governance_signal']
        },
        traceJoinCoverage: {
          status: 'missing',
          evidence: [],
          gaps: ['missing_trace_bundle_builder']
        },
        routerCoverage: {
          status: 'partial',
          evidence: ['file:/tmp/router.js:9'],
          gaps: ['missing_paid_orchestrator_path']
        },
        telemetryCoverage: {
          status: 'partial',
          evidence: ['file:/tmp/summary.js:8'],
          gaps: ['missing_trace_join_signal']
        }
      }
    }
  });

  assert.equal(report.clusterVersion, 'v3');
  assert.ok(report.clusters.length > 0);
  report.clusters.forEach((cluster) => {
    assert.ok(['knowledge', 'router', 'policy', 'readiness', 'integration', 'telemetry'].includes(cluster.category));
    assert.ok(Array.isArray(cluster.evidence));
    assert.ok(Array.isArray(cluster.candidateFiles));
    assert.ok(Array.isArray(cluster.suggestedTests));
    assert.ok(cluster.candidateFiles.length > 0);
  });
});
