'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { resolveV1FeatureMatrix } = require('../../src/v1/shared/featureMatrix');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

test('phase786: llmClient has no runtime toggle that disables Responses API transport', () => {
  const source = read('src/infra/llmClient.js');
  assert.doesNotMatch(source, /ENABLE_V1_OPENAI_RESPONSES/);
  assert.match(source, /callResponsesApi/);
});

test('phase786: feature matrix reports responses transport as runtime-mandatory', () => {
  const matrix = resolveV1FeatureMatrix({ ENABLE_V1_OPENAI_RESPONSES: 'false' });
  assert.equal(matrix.openAiResponses, true);
  assert.equal(matrix.openAiResponsesRequested, false);
});

test('phase786: contract registry marks Responses-only requirement as aligned', () => {
  const registry = readJson('contracts/llm_spec_contract_registry.v2.json');
  const row = registry.requirements.find((item) => item && item.requirementId === 'V2-C-03');
  assert.ok(row, 'V2-C-03 row must exist');
  assert.equal(row.status, 'aligned');
  const hasLegacyConflict = registry.conflicts.some((item) => item && item.conflictId === 'CF-01');
  assert.equal(hasLegacyConflict, false);
});
