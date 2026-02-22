'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { runCityPackSourceAuditJob } = require('../../src/usecases/cityPack/runCityPackSourceAuditJob');

function makeResponse(url) {
  return {
    status: 200,
    ok: true,
    redirected: false,
    url,
    async text() {
      return '<html>ok</html>';
    }
  };
}

test('phase373: source audit job can filter candidates by packClass', async () => {
  const refs = [
    {
      id: 'sr_phase373_regional',
      url: 'https://example.com/regional',
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      usedByCityPackIds: ['cp_regional']
    },
    {
      id: 'sr_phase373_nationwide',
      url: 'https://example.com/nationwide',
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      usedByCityPackIds: ['cp_nationwide']
    }
  ];
  const updated = [];
  const evidence = [];
  const runs = new Map();

  const result = await runCityPackSourceAuditJob({
    runId: 'run_phase373_packclass_filter',
    packClass: 'nationwide',
    stage: 'light',
    mode: 'scheduled',
    now: new Date('2026-03-02T00:00:00.000Z')
  }, {
    getRun: async (runId) => runs.get(runId) || null,
    saveRun: async (runId, patch) => {
      const prev = runs.get(runId) || {};
      runs.set(runId, Object.assign({}, prev, patch));
      return { id: runId };
    },
    listSourceRefsForAudit: async () => refs,
    listSourceRefs: async () => refs,
    getCityPack: async (cityPackId) => {
      if (cityPackId === 'cp_nationwide') return { id: cityPackId, packClass: 'nationwide' };
      return { id: cityPackId, packClass: 'regional' };
    },
    updateSourceRef: async (sourceRefId, patch) => {
      updated.push({ sourceRefId, patch });
      return { id: sourceRefId };
    },
    createEvidence: async (payload) => {
      evidence.push(payload);
      return { id: `ev_${evidence.length}` };
    },
    appendAuditLog: async () => ({ id: 'audit_phase373_packclass' }),
    fetchFn: async (url) => makeResponse(url)
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.packClass, 'nationwide');
  assert.strictEqual(result.processed, 1);
  assert.ok(updated.every((item) => item.sourceRefId === 'sr_phase373_nationwide'));
  assert.ok(evidence.every((item) => item.sourceRefId === 'sr_phase373_nationwide'));
});
