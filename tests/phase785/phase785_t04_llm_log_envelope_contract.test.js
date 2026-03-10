'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');
}

test('phase785: llm action/quality repos stamp recordEnvelope on writes', () => {
  const actionRepo = read('src/repos/firestore/llmActionLogsRepo.js');
  const qualityRepo = read('src/repos/firestore/llmQualityLogsRepo.js');

  assert.match(actionRepo, /recordEnvelope/);
  assert.match(actionRepo, /recordType:\s*'llm_action_log'/);
  assert.match(qualityRepo, /recordEnvelope/);
  assert.match(qualityRepo, /recordType:\s*'llm_quality_log'/);
});
