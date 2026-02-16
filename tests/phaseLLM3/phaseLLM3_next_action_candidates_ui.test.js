'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phaseLLM3: ops_readonly includes next action candidates section', () => {
  const html = readFileSync('apps/admin/ops_readonly.html', 'utf8');
  assert.ok(html.includes('ops-console-detail-next-actions'));
  assert.ok(html.includes('ops-console-detail-next-actions-status'));
  assert.ok(html.includes('/api/phaseLLM3/ops-next-actions'));
});
