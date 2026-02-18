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

test('phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths', async () => {
  const refs = [
    { id: 'sr_ok', url: 'https://example.com/ok', status: 'active', validUntil: '2099-12-31T00:00:00.000Z', contentHash: null },
    { id: 'sr_redirect', url: 'https://example.com/redirect', status: 'active', validUntil: '2099-12-31T00:00:00.000Z', contentHash: null },
    { id: 'sr_404', url: 'https://example.com/404', status: 'active', validUntil: '2099-12-31T00:00:00.000Z', contentHash: null },
    { id: 'sr_403', url: 'https://example.com/403', status: 'active', validUntil: '2099-12-31T00:00:00.000Z', contentHash: null },
    { id: 'sr_timeout', url: 'https://example.com/timeout', status: 'active', validUntil: '2099-12-31T00:00:00.000Z', contentHash: null }
  ];

  const runStore = new Map();
  const evidences = [];
  const updates = [];

  const result = await runCityPackSourceAuditJob(
    {
      runId: 'run_phase250_classify',
      mode: 'scheduled',
      targetSourceRefIds: refs.map((r) => r.id),
      traceId: 'trace_phase250_classify',
      now: new Date('2026-02-18T00:00:00.000Z')
    },
    {
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
      appendAuditLog: async () => ({ id: 'audit_phase250_classify' }),
      fetchFn: async (url) => {
        if (url.endsWith('/ok')) {
          return makeResponse({
            status: 200,
            redirected: false,
            url,
            body: '<html>ok</html>'
          });
        }
        if (url.endsWith('/redirect')) {
          return makeResponse({
            status: 200,
            redirected: true,
            url: 'https://example.com/final',
            body: '<html>redirected</html>'
          });
        }
        if (url.endsWith('/404')) {
          return makeResponse({
            status: 404,
            redirected: false,
            url,
            body: 'not found'
          });
        }
        if (url.endsWith('/403')) {
          return makeResponse({
            status: 403,
            redirected: false,
            url,
            body: 'forbidden'
          });
        }
        const err = new Error('timeout');
        err.name = 'AbortError';
        throw err;
      },
      captureScreenshots: async ({ sourceRefId }) => [`gs://bucket/city-pack/${sourceRefId}.png`]
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.processed, 5);
  assert.strictEqual(result.succeeded, 5);
  assert.strictEqual(result.failed, 0);
  assert.strictEqual(evidences.length, 5);

  const bySource = new Map(evidences.map((item) => [item.sourceRefId, item]));
  assert.strictEqual(bySource.get('sr_ok').result, 'ok');
  assert.strictEqual(bySource.get('sr_redirect').result, 'redirect');
  assert.strictEqual(bySource.get('sr_404').result, 'http_error');
  assert.strictEqual(bySource.get('sr_403').result, 'http_error');
  assert.strictEqual(bySource.get('sr_timeout').result, 'timeout');
  assert.ok(Array.isArray(bySource.get('sr_ok').screenshotPaths));
  assert.strictEqual(bySource.get('sr_ok').screenshotPaths[0], 'gs://bucket/city-pack/sr_ok.png');

  const statusById = new Map(updates.map((item) => [item.sourceRefId, item.patch.status]));
  assert.strictEqual(statusById.get('sr_ok'), 'active');
  assert.strictEqual(statusById.get('sr_redirect'), 'active');
  assert.strictEqual(statusById.get('sr_404'), 'dead');
  assert.strictEqual(statusById.get('sr_403'), 'dead');
  assert.strictEqual(statusById.get('sr_timeout'), 'dead');
});
