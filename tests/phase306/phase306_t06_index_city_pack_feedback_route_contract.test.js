'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase306: index routes include city-pack-feedback triage/resolve actions', () => {
  const file = readFileSync('src/index.js', 'utf8');
  assert.ok(file.includes('/^\\/api\\/admin\\/city-pack-feedback\\/[^/]+(\\/(ack|triage|resolve|reject|propose))?$/.test(pathname)'));
});
