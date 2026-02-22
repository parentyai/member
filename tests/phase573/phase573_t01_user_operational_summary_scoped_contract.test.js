'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase573: user operational summary uses scoped-first events/checklists path', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/usecases/admin/getUserOperationalSummary.js'), 'utf8');
  assert.ok(src.includes('listEventsByLineUserIdsAndCreatedAtRange'));
  assert.ok(src.includes('listChecklistsByScenarioStepPairs'));
  assert.ok(src.includes('listUserChecklistsByLineUserIds'));
  assert.ok(src.includes("if (eventsResult.failed && !fallbackBlocked)"));
  assert.ok(src.includes("if (checklistsResult.failed || checklists.length === 0)"));
});

test('phase573: analytics read repo exports multi lineUserId events query', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/repos/firestore/analyticsReadRepo.js'), 'utf8');
  assert.ok(src.includes('async function listEventsByLineUserIdsAndCreatedAtRange(opts)'));
  assert.ok(src.includes('listEventsByLineUserIdsAndCreatedAtRange,'));
});
