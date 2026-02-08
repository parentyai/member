'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase31 t01: ops_readonly includes ops console list/detail/submit sections', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const requiredIds = [
    'ops-console-list-section',
    'ops-console-list-rows',
    'ops-console-list-note',
    'ops-console-detail-section',
    'ops-console-detail-line-user-id',
    'ops-decision-action',
    'ops-decision-submit',
    'ops-decision-result'
  ];
  requiredIds.forEach((id) => {
    assert.ok(html.includes(`id=\"${id}\"`), `missing id: ${id}`);
  });
});

