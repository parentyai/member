'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase620 batch: sourceEvidenceRepo no longer carries missing-index fallback branch', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/sourceEvidenceRepo.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes('async function listEvidenceByTraceId(traceId, limit)'));
  assert.ok(!src.includes('isMissingIndexError('));
  assert.ok(!src.includes('recordMissingIndexFallback('));
  assert.ok(!src.includes('shouldFailOnMissingIndex('));
});
