'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectEmergencySyncProviderKeys,
  runEmergencySyncInChunks
} = require('../../tools/admin_bootstrap_city_emergency');

test('phase674: emergency bootstrap chunking deduplicates provider order from rule specs', () => {
  const providerKeys = collectEmergencySyncProviderKeys([
    { providerKey: 'openfda_recalls' },
    { providerKey: 'nws_alerts' },
    { providerKey: 'nws_alerts' },
    { providerKey: 'usgs_earthquakes' }
  ]);

  assert.deepEqual(providerKeys, [
    'openfda_recalls',
    'nws_alerts',
    'usgs_earthquakes'
  ]);
});

test('phase674: emergency bootstrap chunking runs one sync per provider and flattens results', async () => {
  const seen = [];
  const result = await runEmergencySyncInChunks({
    traceId: 'trace_test',
    runId: 'run_test',
    actor: 'tester',
    forceRefresh: true,
    skipSummarize: true,
    ruleSpecs: [
      { providerKey: 'openfda_recalls' },
      { providerKey: 'nws_alerts' },
      { providerKey: 'usgs_earthquakes' }
    ]
  }, {
    runEmergencySync: async (params) => {
      seen.push(params);
      return {
        ok: true,
        runId: params.runId,
        providerCount: 1,
        providerResults: [{ providerKey: params.providerKey }],
        autoDispatchPlan: [{ providerKey: params.providerKey, reason: 'noop' }],
        autoDispatchResults: []
      };
    }
  });

  assert.deepEqual(seen.map((item) => item.providerKey), [
    'openfda_recalls',
    'nws_alerts',
    'usgs_earthquakes'
  ]);
  assert.deepEqual(seen.map((item) => item.runId), [
    'run_test__openfda_recalls',
    'run_test__nws_alerts',
    'run_test__usgs_earthquakes'
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.syncChunkCount, 3);
  assert.deepEqual(result.providerKeys, [
    'openfda_recalls',
    'nws_alerts',
    'usgs_earthquakes'
  ]);
  assert.equal(result.providerResults.length, 3);
  assert.equal(result.autoDispatchPlan.length, 3);
});
