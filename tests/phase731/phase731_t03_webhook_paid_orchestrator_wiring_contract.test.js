'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase731: webhook paid path wires orchestrator behind dedicated flag', () => {
  const source = read('src/routes/webhookLine.js');
  [
    'resolvePaidOrchestratorEnabled',
    'resolveV1ActionGatewayEnabled',
    'ENABLE_PAID_ORCHESTRATOR_V2',
    'ENABLE_V1_ACTION_GATEWAY',
    'tryHandlePaidOrchestratorV2',
    'runPaidConversationOrchestrator',
    'actionGatewayEnabled',
    'actionGatewayDecision',
    'actionGatewayReason',
    'strategy:',
    'judgeWinner:',
    'verificationOutcome:',
    'candidateCount:'
  ].forEach((token) => {
    assert.ok(source.includes(token), token);
  });
});
