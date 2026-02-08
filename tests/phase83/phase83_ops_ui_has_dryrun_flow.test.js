'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase83: ops_readonly includes dry-run flow', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const requiredIds = [
    'segment-dryrun',
    'segment-dryrun-result'
  ];
  requiredIds.forEach((id) => {
    assert.ok(html.includes(`id=\"${id}\"`), `missing id: ${id}`);
  });
});
