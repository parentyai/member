'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase31 t02: ops_readonly defines ops console fetch/submit helpers', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const requiredFns = [
    'function fetchOpsConsoleList',
    'function fetchOpsConsoleDetail',
    'function submitOpsDecisionRequest',
    'function loadOpsConsoleList',
    'function loadOpsConsoleDetail',
    'function handleSubmitOpsDecision'
  ];
  requiredFns.forEach((signature) => {
    assert.ok(html.includes(signature), `missing function: ${signature}`);
  });
  assert.ok(html.includes('/api/phase26/ops-console/list'), 'missing list endpoint');
  assert.ok(html.includes('/api/phase25/ops/console'), 'missing detail endpoint');
  assert.ok(html.includes('/api/phase25/ops/decision'), 'missing submit endpoint');
});

