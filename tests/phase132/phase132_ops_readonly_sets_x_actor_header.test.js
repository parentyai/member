'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase132: ops_readonly.html sets x-actor header to avoid actor=unknown', async () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  assert.ok(html.includes("'x-actor': 'ops_readonly'"));
});

