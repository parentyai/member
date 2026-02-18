'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase252: index routes include city-pack-source-audit/runs', () => {
  const indexJs = readFileSync('src/index.js', 'utf8');
  assert.ok(indexJs.includes("pathname === '/api/admin/city-pack-source-audit/runs'"));
});

