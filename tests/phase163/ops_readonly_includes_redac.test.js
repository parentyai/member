'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

test('ops readonly ui includes Redac status display label', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  assert.ok(html.includes('ops-console-detail-redac-status'));
  assert.ok(html.includes('Redac（derived）'));
});
