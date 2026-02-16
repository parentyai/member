'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function read(path) {
  return readFileSync(path, 'utf8');
}

test('phase201: ops/monitor/read_model include status summary panels', () => {
  const ops = read('apps/admin/ops_readonly.html');
  assert.ok(ops.includes('id="ops-status-pill"'));
  assert.ok(ops.includes('id="ops-status-summary"'));
  assert.ok(ops.includes('status-ok'));
  assert.ok(ops.includes('status-danger'));

  const monitor = read('apps/admin/monitor.html');
  assert.ok(monitor.includes('id="monitor-status-pill"'));
  assert.ok(monitor.includes('id="monitor-status-summary"'));
  assert.ok(monitor.includes('status-warn'));
  assert.ok(monitor.includes('status-danger'));

  const readModel = read('apps/admin/read_model.html');
  assert.ok(readModel.includes('id="read-model-status-pill"'));
  assert.ok(readModel.includes('id="read-model-status-summary"'));
  assert.ok(readModel.includes('status-warn'));
  assert.ok(readModel.includes('status-danger'));
});
