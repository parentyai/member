'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { logRouteError } = require('../../src/routes/admin/osContext');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

test('phase179: notification routes include structured route_error logging + trace/request in 500 payload', () => {
  const targets = [
    { file: 'src/routes/phase61Templates.js', routeId: 'phase61.templates' },
    { file: 'src/routes/phase66Segments.js', routeId: 'phase66.send_targets' },
    { file: 'src/routes/phase67PlanSend.js', routeId: 'phase67.plan_send' },
    { file: 'src/routes/phase73RetryQueue.js', routeId: 'phase73.retry_queue' },
    { file: 'src/routes/admin/osNotifications.js', routeId: 'admin.os_notifications' }
  ];

  for (const target of targets) {
    const contents = read(target.file);
    assert.match(contents, /logRouteError/, `${target.file}: logRouteError missing`);
    assert.match(contents, new RegExp(target.routeId.replace(/\./g, '\\.')), `${target.file}: route id missing`);
    assert.match(contents, /error: 'error', traceId, requestId/, `${target.file}: 500 payload missing trace/request`);
  }
});

test('phase179: logRouteError emits sanitized structured line', () => {
  const outputs = [];
  const original = console.error;
  console.error = (line) => outputs.push(String(line));
  try {
    logRouteError(
      'phase73.retry_queue',
      { name: 'Boom Error', message: 'unexpected fatal error' },
      { traceId: 'trace 123', requestId: 'req 456', actor: 'admin ops' }
    );
  } finally {
    console.error = original;
  }

  assert.strictEqual(outputs.length, 1);
  const line = outputs[0];
  assert.match(line, /\[route_error\] route=phase73\.retry_queue/);
  assert.match(line, /name=Boom_Error/);
  assert.match(line, /message=unexpected_fatal_error/);
  assert.match(line, /traceId=trace_123/);
  assert.match(line, /requestId=req_456/);
  assert.match(line, /actor=admin_ops/);
});
