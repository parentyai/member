'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { traceCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: trace core resolves and forwards traceId across urls', () => {
  const generated = traceCore.newTraceId();
  assert.equal(typeof generated, 'string');
  assert.ok(generated.length > 8);

  const fromQuery = traceCore.getTraceFromUrl('?pane=alerts&traceId=trace_abc');
  assert.equal(fromQuery, 'trace_abc');

  const forwarded = traceCore.forwardTraceToUrl('/admin/app?pane=audit', 'trace_xyz');
  assert.ok(forwarded.includes('pane=audit'));
  assert.ok(forwarded.includes('traceId=trace_xyz'));
});
