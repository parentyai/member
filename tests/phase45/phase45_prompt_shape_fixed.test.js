'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildOpsAssistPrompt, SCHEMA_VERSION } = require('../../src/usecases/phase45/buildOpsAssistPrompt');

test('phase45: prompt payload shape is fixed', () => {
  const result = buildOpsAssistPrompt({
    opsConsoleView: {
      readiness: { status: 'READY', blocking: [] },
      opsState: { nextAction: 'NO_ACTION' },
      latestDecisionLog: { id: 'd1' },
      userStateSummary: { lineUserId: 'U1' },
      memberSummary: { lineUserId: 'U1' },
      allowedNextActions: ['NO_ACTION']
    }
  });

  assert.strictEqual(result.schemaVersion, SCHEMA_VERSION);
  assert.ok(typeof result.system === 'string');
  assert.ok(typeof result.user === 'string');
  assert.ok(result.constraints);
  assert.deepStrictEqual(result.constraints.allowedNextActions, ['NO_ACTION']);
  const parsed = JSON.parse(result.user);
  assert.strictEqual(parsed.readiness.status, 'READY');
});
