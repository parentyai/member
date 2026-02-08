'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase78: ops_readonly includes saved segments dropdown', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const requiredIds = [
    'saved-segment-select',
    'segment-template-version'
  ];
  requiredIds.forEach((id) => {
    assert.ok(html.includes(`id=\"${id}\"`), `missing id: ${id}`);
  });
});
