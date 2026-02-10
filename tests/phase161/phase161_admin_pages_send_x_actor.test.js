'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function read(path) {
  return readFileSync(path, 'utf8');
}

test('phase161: admin pages include x-actor headers', () => {
  const ops = read('apps/admin/ops_readonly.html');
  assert.ok(ops.includes("'x-actor': 'ops_readonly'"));
  assert.ok(ops.includes('x-trace-id'));

  const composer = read('apps/admin/composer.html');
  assert.ok(composer.includes("'x-actor': 'admin_composer'"));
  assert.ok(composer.includes("'x-trace-id'"));

  const monitor = read('apps/admin/monitor.html');
  assert.ok(monitor.includes("'x-actor': 'admin_monitor'"));

  const errors = read('apps/admin/errors.html');
  assert.ok(errors.includes("'x-actor': 'admin_errors'"));

  const master = read('apps/admin/master.html');
  assert.ok(master.includes("'x-actor': 'admin_master'"));

  const readModel = read('apps/admin/read_model.html');
  assert.ok(readModel.includes("'x-actor': 'admin_read_model'"));

  const review = read('apps/admin/review.html');
  assert.ok(review.includes("'x-actor': 'admin_review'"));
});

