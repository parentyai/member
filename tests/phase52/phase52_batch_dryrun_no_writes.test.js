'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { runOpsBatch } = require('../../src/usecases/phase52/runOpsBatch');

test('phase52: dry-run does not call writers', async () => {
  let called = false;
  const result = await runOpsBatch({
    jobKey: 'refresh_ops_console',
    dryRun: true,
    limit: 10
  }, {
    refreshOpsConsole: async () => { called = true; }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(called, false);
});
