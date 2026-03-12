'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

test('phase806: docs include quality loop v2 critical slices and rollout stages', () => {
  const runbook = read('docs/LLM_RUNBOOK.md');
  const framework = read('docs/SSOT_LLM_QUALITY_FRAMEWORK_V1.md');
  const rollout = read('docs/rollout_plan.md');
  const loopV2 = read('docs/LLM_QUALITY_LOOP_V2.md');

  [
    'emergency_high_risk',
    'saved_faq_high_risk_reuse',
    'journey_blocker_conflict',
    'stale_city_pack_required_source',
    'trace_join_incomplete'
  ].forEach((token) => {
    assert.ok(runbook.includes(token));
    assert.ok(framework.includes(token));
    assert.ok(rollout.includes(token));
    assert.ok(loopV2.includes(token));
  });

  [
    'design_only',
    'log_only',
    'soft_enforcement',
    'hard_enforcement',
    'nogo_gate_mandatory',
    'continuous_improvement_loop_active'
  ].forEach((token) => {
    assert.ok(rollout.includes(token));
    assert.ok(loopV2.includes(token));
  });
});
