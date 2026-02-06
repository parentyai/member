'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const cli = require('../../scripts/phase22_list_kpi_snapshots');

test('phase22 t06: defaults return JSON', async () => {
  const result = await cli.runList([], {
    repo: { listSnapshots: async () => ([{ id: '1' }]) },
    nowIso: () => '2026-02-05T00:00:00Z'
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.count, 1);
  assert.equal(result.output.filters.limit, 20);
  assert.equal(result.output.filters.order, 'desc');
});

test('phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2', async () => {
  const errors = [];
  const result = await cli.runList([], {
    repo: { listSnapshots: async () => { throw new Error('boom'); } },
    logger: { error: (msg) => errors.push(msg) },
    nowIso: () => '2026-02-05T00:00:00Z'
  });
  assert.equal(result.exitCode, 2);
  assert.ok(errors[0].includes('LIST_ENV_ERROR:'));
});
