'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js'), 'utf8');
  assert.ok(src.includes('listChecklistsByScenarioAndStep') || src.includes('listChecklistsByScenarioStepPairs'));
  assert.ok(src.includes('eventsResult.failed'));
  assert.ok(src.includes('deliveriesResult.failed'));
  assert.ok(src.includes('checklistsResult.failed'));
  assert.ok(!src.includes('if (eventsResult.failed || events.length === 0) {'));
  assert.ok(!src.includes('if (deliveriesResult.failed || deliveries.length === 0) {'));
});
