'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phaseLLM2: ops_readonly renders llm explanation section', () => {
  const html = readFileSync('apps/admin/ops_readonly.html', 'utf8');
  assert.ok(html.includes('ops-console-detail-llm-explanation'));
  assert.ok(html.includes('ops-console-detail-llm-explanation-status'));
  assert.ok(html.includes('/api/phaseLLM2/ops-explain'));
});
