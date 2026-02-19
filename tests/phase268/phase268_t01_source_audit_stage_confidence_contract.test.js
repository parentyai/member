'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { runCityPackSourceAuditJob } = require('../../src/usecases/cityPack/runCityPackSourceAuditJob');

function makeResponse({ status, redirected, url, body }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: Boolean(redirected),
    url,
    async text() {
      return body;
    }
  };
}

test('phase268: light/heavy stage updates source confidence and stage fields', async () => {
  const refs = [
    {
      id: 'sr_stage_001',
      url: 'https://example.com/source-stage',
      status: 'active',
      requiredLevel: 'required',
      riskLevel: 'medium',
      validUntil: '2099-12-31T00:00:00.000Z',
      contentHash: 'prev_hash'
    }
  ];

  const runStore = new Map();
  const evidences = [];
  const updates = [];
  let screenshotCalls = 0;
  let llmCalls = 0;

  const commonDeps = {
    getRun: async (runId) => runStore.get(runId) || null,
    saveRun: async (runId, patch) => {
      const prev = runStore.get(runId) || {};
      runStore.set(runId, Object.assign({}, prev, patch));
      return { id: runId };
    },
    listSourceRefs: async () => refs,
    listSourceRefsForAudit: async () => refs,
    updateSourceRef: async (sourceRefId, patch) => {
      updates.push({ sourceRefId, patch });
      return { id: sourceRefId };
    },
    createEvidence: async (payload) => {
      evidences.push(payload);
      return { id: `ev_${evidences.length}` };
    },
    appendAuditLog: async () => ({ id: 'audit_phase268' }),
    fetchFn: async (url) => makeResponse({
      status: 200,
      redirected: false,
      url,
      body: '<html>next_hash</html>'
    }),
    captureScreenshots: async ({ sourceRefId }) => {
      screenshotCalls += 1;
      return [`gs://bucket/${sourceRefId}.png`];
    },
    summarizeDiff: async () => {
      llmCalls += 1;
      return {
        llm_used: true,
        model: 'gpt-5',
        promptVersion: 'city-pack-diff-v1',
        diffSummary: 'diff detected'
      };
    }
  };

  const light = await runCityPackSourceAuditJob({
    runId: 'run_phase268_light',
    mode: 'scheduled',
    stage: 'light',
    targetSourceRefIds: ['sr_stage_001'],
    traceId: 'trace_phase268_light',
    now: new Date('2026-02-19T00:00:00.000Z')
  }, commonDeps);

  assert.strictEqual(light.ok, true);
  assert.strictEqual(light.stage, 'light');
  assert.strictEqual(screenshotCalls, 0);
  assert.strictEqual(llmCalls, 0);
  assert.strictEqual(evidences[0].screenshotPaths.length, 0);
  assert.strictEqual(evidences[0].llm_used, false);
  assert.strictEqual(updates[0].patch.lastAuditStage, 'light');
  assert.ok(Number.isFinite(Number(updates[0].patch.confidenceScore)));

  const heavy = await runCityPackSourceAuditJob({
    runId: 'run_phase268_heavy',
    mode: 'canary',
    stage: 'heavy',
    targetSourceRefIds: ['sr_stage_001'],
    traceId: 'trace_phase268_heavy',
    now: new Date('2026-02-19T01:00:00.000Z')
  }, commonDeps);

  assert.strictEqual(heavy.ok, true);
  assert.strictEqual(heavy.stage, 'heavy');
  assert.ok(screenshotCalls >= 1);
  assert.ok(llmCalls >= 1);
  assert.ok(evidences.some((item) => item.traceId === 'trace_phase268_heavy' && item.screenshotPaths.length === 1));
  assert.ok(updates.some((item) => item.patch.lastAuditStage === 'heavy'));
});
