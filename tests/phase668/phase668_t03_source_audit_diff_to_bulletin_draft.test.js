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

test('phase668: source audit creates bulletin drafts when diff_detected for city-pack-linked source', async () => {
  const refs = [
    {
      id: 'sr_phase668_diff',
      url: 'https://example.com/school-calendar',
      status: 'active',
      validUntil: '2099-12-31T00:00:00.000Z',
      contentHash: 'old_hash',
      usedByCityPackIds: ['cp_phase668_1', 'cp_phase668_2']
    }
  ];
  const runStore = new Map();
  const createdBulletins = [];

  const result = await runCityPackSourceAuditJob({
    runId: 'run_phase668_diff_001',
    mode: 'canary',
    stage: 'heavy',
    targetSourceRefIds: ['sr_phase668_diff'],
    traceId: 'trace_phase668_diff',
    now: new Date('2026-02-20T00:00:00.000Z')
  }, {
    getRun: async (runId) => runStore.get(runId) || null,
    saveRun: async (runId, patch) => {
      const prev = runStore.get(runId) || {};
      runStore.set(runId, Object.assign({}, prev, patch));
      return { id: runId };
    },
    listSourceRefs: async () => refs,
    listSourceRefsForAudit: async () => refs,
    updateSourceRef: async () => ({ ok: true }),
    createEvidence: async (_payload) => ({ id: 'ev_phase668_diff' }),
    createBulletin: async (payload) => {
      createdBulletins.push(payload);
      return { id: payload.id };
    },
    appendAuditLog: async () => ({ id: 'audit_phase668_diff' }),
    fetchFn: async (url) => makeResponse({
      status: 200,
      redirected: false,
      url,
      body: '<html>new_hash</html>'
    }),
    captureScreenshots: async () => [],
    summarizeDiff: async () => ({
      llm_used: true,
      model: 'gpt-5',
      promptVersion: 'city-pack-diff-v1',
      diffSummary: 'calendar changed'
    })
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.processed, 1);
  assert.strictEqual(result.bulletinDraftCount, 2);
  assert.strictEqual(createdBulletins.length, 2);
  assert.ok(createdBulletins.every((item) => item.status === 'draft'));
  assert.ok(createdBulletins.every((item) => item.origin === 'source_audit'));
  assert.ok(createdBulletins.every((item) => item.sourceRefId === 'sr_phase668_diff'));
  assert.ok(createdBulletins.every((item) => item.notificationId === null));
});
