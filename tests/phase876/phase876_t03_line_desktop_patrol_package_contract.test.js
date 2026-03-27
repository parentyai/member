'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../../package.json');

test('phase876: package.json exposes the reply-gap regression suite', () => {
  assert.equal(packageJson.scripts['test:phase876'], 'node --test tests/phase876/*.test.js');
});
