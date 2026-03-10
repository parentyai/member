'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function read(filePath) {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
}

test('phase778: admin/compat LLM routes include shared answer-readiness telemetry wiring', () => {
  const adminOps = read('src/routes/admin/llmOps.js');
  const compatOpsExplain = read('src/routes/phaseLLM2OpsExplain.js');
  const compatNextActions = read('src/routes/phaseLLM3OpsNextActions.js');
  const adminFaq = read('src/routes/admin/llmFaq.js');
  const compatFaq = read('src/routes/phaseLLM4FaqAnswer.js');

  assert.ok(adminOps.includes('resolveSharedAnswerReadiness'));
  assert.ok(adminOps.includes('readinessDecision'));
  assert.ok(adminOps.includes('intentRiskTier'));
  assert.ok(adminOps.includes('actionGatewayDecision'));
  assert.ok(adminOps.includes('actionGatewayReason'));

  assert.ok(compatOpsExplain.includes('resolveSharedAnswerReadiness'));
  assert.ok(compatOpsExplain.includes('readinessDecision'));
  assert.ok(compatOpsExplain.includes('actionGatewayDecision'));

  assert.ok(compatNextActions.includes('resolveSharedAnswerReadiness'));
  assert.ok(compatNextActions.includes('readinessSafeResponseMode'));
  assert.ok(compatNextActions.includes('actionGatewayReason'));

  assert.ok(adminFaq.includes('readinessDecision: result && result.readinessDecision'));
  assert.ok(compatFaq.includes('readinessDecision: result && result.readinessDecision'));
});
