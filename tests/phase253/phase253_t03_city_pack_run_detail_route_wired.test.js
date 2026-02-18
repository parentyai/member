'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase253: index routes include city-pack-source-audit/runs/:runId', () => {
  const indexJs = readFileSync('src/index.js', 'utf8');
  assert.ok(indexJs.includes('/^\\/api\\/admin\\/city-pack-source-audit\\/runs\\/[^/]+$/'));
});

