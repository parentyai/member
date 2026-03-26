'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidation } = require('../../tools/line_desktop_patrol/validate_scaffold');

test('phase857: line desktop patrol scaffold stays disabled and dry-run by default', () => {
  const result = runValidation();
  assert.equal(result.ok, true);
  assert.equal(result.schemaCount, 4);
  assert.equal(result.sampleTargetCount, 1);
  assert.equal(result.scenarioId, 'smoke_dry_run_echo');
});
