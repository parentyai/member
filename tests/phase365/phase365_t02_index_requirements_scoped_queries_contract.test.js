'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase365: index requirements include scoped checklist/delivery query entries', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/INDEX_REQUIREMENTS.md'), 'utf8');
  assert.ok(text.includes('analyticsReadRepo.listNotificationDeliveriesByLineUserIdsAndSentAtRange'));
  assert.ok(text.includes('analyticsReadRepo.listChecklistsByScenarioStepPairs'));
});
