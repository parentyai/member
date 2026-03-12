'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { resolveLlmLegalPolicySnapshot } = require('../../src/domain/llm/policy/resolveLlmLegalPolicySnapshot');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase801: resolveLlmLegalPolicySnapshot preserves policy source/context and emergency hint', () => {
  const snapshot = resolveLlmLegalPolicySnapshot({
    policy: {
      lawfulBasis: 'contract',
      consentVerified: true,
      crossBorder: false
    },
    policySource: 'admin_ops_default',
    policyContext: 'admin_ops',
    emergencyHintActive: true
  });

  assert.equal(snapshot.policySource, 'admin_ops_default');
  assert.equal(snapshot.policyContext, 'admin_ops');
  assert.equal(snapshot.emergencyHintActive, true);
  assert.equal(snapshot.legalDecision, 'allow');
  assert.ok(snapshot.legalReasonCodes.includes('emergency_priority_context'));
  assert.ok(snapshot.legalReasonCodes.includes('policy_context_admin_ops'));
});

test('phase801: admin and compat ops routes emit policy source/context into gate payloads', () => {
  const adminOpsRoute = read('src/routes/admin/llmOps.js');
  const compatExplainRoute = read('src/routes/phaseLLM2OpsExplain.js');
  const compatNextActionsRoute = read('src/routes/phaseLLM3OpsNextActions.js');
  const appendGate = read('src/usecases/llm/appendLlmGateDecision.js');
  const llmAuditGuard = read('src/domain/audit/llmAuditPayloadGuard.js');

  assert.ok(adminOpsRoute.includes("policySource: 'admin_ops_default'"));
  assert.ok(adminOpsRoute.includes("policyContext: 'admin_ops'"));
  assert.ok(adminOpsRoute.includes('policySource: legalSnapshot.policySource'));
  assert.ok(adminOpsRoute.includes('policyContext: legalSnapshot.policyContext'));

  assert.ok(compatExplainRoute.includes("policySource: 'compat_ops_default'"));
  assert.ok(compatExplainRoute.includes("policyContext: 'compat_ops'"));
  assert.ok(compatExplainRoute.includes('policySource: legalSnapshot.policySource'));
  assert.ok(compatExplainRoute.includes('policyContext: legalSnapshot.policyContext'));

  assert.ok(compatNextActionsRoute.includes("policySource: 'compat_ops_default'"));
  assert.ok(compatNextActionsRoute.includes("policyContext: 'compat_ops'"));
  assert.ok(compatNextActionsRoute.includes('policySource: legalSnapshot.policySource'));
  assert.ok(compatNextActionsRoute.includes('policyContext: legalSnapshot.policyContext'));

  assert.ok(appendGate.includes("'policySource'"));
  assert.ok(appendGate.includes("'policyContext'"));
  assert.ok(llmAuditGuard.includes("'policySource'"));
  assert.ok(llmAuditGuard.includes("'policyContext'"));
});
