'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  normalizeEntryType,
  normalizeGatesApplied
} = require('../../src/usecases/llm/appendLlmGateDecision');
const { buildGateAuditBaseline } = require('../../src/routes/admin/osLlmUsageSummary');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase717: llm gate writer normalizes entryType and gatesApplied', () => {
  assert.equal(normalizeEntryType('webhook'), 'webhook');
  assert.equal(normalizeEntryType('ADMIN'), 'admin');
  assert.equal(normalizeEntryType('unknown_value'), 'unknown');
  assert.deepEqual(normalizeGatesApplied(['kill_switch', 'INJECTION', 'invalid']), ['kill_switch', 'injection']);
});

test('phase717: gate baseline aggregates entryType and gates coverage', () => {
  const baseline = buildGateAuditBaseline([
    { payloadSummary: { decision: 'allow', entryType: 'webhook', gatesApplied: ['kill_switch', 'url_guard'] } },
    { payloadSummary: { decision: 'blocked', blockedReason: 'citation_missing', entryType: 'admin', gatesApplied: ['kill_switch'] } },
    { payloadSummary: { decision: 'blocked', blockedReason: 'template_violation', entryType: 'compat', gatesApplied: ['kill_switch', 'injection'] } }
  ]);

  assert.equal(baseline.callsTotal, 3);
  const entryTypes = Object.fromEntries((baseline.entryTypes || []).map((row) => [row.entryType, row.count]));
  const gatesCoverage = Object.fromEntries((baseline.gatesCoverage || []).map((row) => [row.gate, row.count]));
  assert.equal(entryTypes.webhook, 1);
  assert.equal(entryTypes.admin, 1);
  assert.equal(entryTypes.compat, 1);
  assert.equal(gatesCoverage.kill_switch, 3);
  assert.equal(gatesCoverage.url_guard, 1);
  assert.equal(gatesCoverage.injection, 1);
});

test('phase717: webhook/admin/compat routes set entryType and gatesApplied for llm_gate.decision', () => {
  const webhook = read('src/routes/webhookLine.js');
  const adminFaq = read('src/routes/admin/llmFaq.js');
  const adminOps = read('src/routes/admin/llmOps.js');
  const compat2 = read('src/routes/phaseLLM2OpsExplain.js');
  const compat3 = read('src/routes/phaseLLM3OpsNextActions.js');
  const compat4 = read('src/routes/phaseLLM4FaqAnswer.js');

  assert.ok(webhook.includes("entryType: 'webhook'"));
  assert.ok(webhook.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));

  assert.ok(adminFaq.includes("entryType: 'admin'"));
  assert.ok(adminFaq.includes("gatesApplied: ['kill_switch', 'url_guard']"));
  assert.ok(adminOps.includes("entryType: 'admin'"));
  assert.ok(adminOps.includes("gatesApplied: ['kill_switch']"));

  assert.ok(compat2.includes("entryType: 'compat'"));
  assert.ok(compat2.includes("gatesApplied: ['kill_switch']"));
  assert.ok(compat3.includes("entryType: 'compat'"));
  assert.ok(compat3.includes("gatesApplied: ['kill_switch']"));
  assert.ok(compat4.includes("entryType: 'compat'"));
  assert.ok(compat4.includes("gatesApplied: ['kill_switch', 'url_guard']"));
});
