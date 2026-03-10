'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase790: contract registry marks V2-C-04 semantic response object requirement as aligned', () => {
  const registry = JSON.parse(fs.readFileSync('contracts/llm_spec_contract_registry.v2.json', 'utf8'));
  const semanticRow = registry.requirements.find((row) => row && row.requirementId === 'V2-C-04');
  assert.ok(semanticRow, 'V2-C-04 must exist');
  assert.equal(semanticRow.status, 'aligned');
});

test('phase790: webhook runtime reply paths enforce semantic reply envelope before send and telemetry', () => {
  const webhook = fs.readFileSync('src/routes/webhookLine.js', 'utf8');
  assert.ok(webhook.includes('function buildSemanticReplyEnvelope('), 'semantic envelope helper must exist');
  assert.ok(webhook.includes('const orchestratedReplyEnvelope = buildSemanticReplyEnvelope('), 'orchestrated paid path must use semantic envelope');
  assert.ok(webhook.includes('const semanticReplyEnvelope = buildSemanticReplyEnvelope('), 'non-orchestrated reply paths must use semantic envelope');
  assert.ok(
    webhook.includes('responseContractConformance: orchestratedReplyEnvelope.responseContractConformance'),
    'orchestrated telemetry must include semantic response conformance'
  );
  assert.ok(
    webhook.includes('responseContractConformance: semanticReplyEnvelope.responseContractConformance'),
    'runtime telemetry must include semantic response conformance'
  );
});
