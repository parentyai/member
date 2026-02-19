'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase273: index wires /api/admin/city-pack-metrics into city pack admin route set', () => {
  const file = readFileSync('src/index.js', 'utf8');
  assert.match(file, /pathname === '\/api\/admin\/city-pack-metrics'/);
  assert.match(file, /handleCityPackReviewInbox/);
});

