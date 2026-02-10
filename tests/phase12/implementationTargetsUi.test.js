'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

test('ops readonly ui includes implementation targets section', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');

  assert.ok(html.includes('Implementation Targets'));
  assert.ok(html.includes('implementation-targets-rows'));
  assert.ok(html.includes('/admin/implementation-targets'));
  assert.ok(html.includes('loadImplementationTargets'));
});
