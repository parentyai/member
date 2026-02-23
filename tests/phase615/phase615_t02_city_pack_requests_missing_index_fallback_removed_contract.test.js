'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase615 batch: cityPackRequestsRepo no longer carries missing-index fallback branch', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/cityPackRequestsRepo.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes('async function listRequests(params)'));
  assert.ok(!src.includes('isMissingIndexError('));
  assert.ok(!src.includes('recordMissingIndexFallback('));
  assert.ok(!src.includes('shouldFailOnMissingIndex('));
});

