'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js'), 'utf8');
  assert.ok(src.includes('listChecklistsByScenarioAndStep') || src.includes('listChecklistsByScenarioStepPairs'));
  assert.ok(src.includes('listNotificationDeliveriesByLineUserIdsAndSentAtRange'));
  assert.ok(src.includes('deliveriesResult.failed'));
  assert.ok(src.includes('checklistsResult.failed'));
  assert.ok(src.includes('userChecklistsResult.failed'));
});
