'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase352: phase5 state summary prefers checklist scoped read path with fallback guard', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('listChecklistsByScenarioAndStep'));
  assert.ok(src.includes('const checklistsPromise = safeQuery(() => listChecklistsByScenarioAndStep({'));
  assert.ok(src.includes('if (checklistsResult.failed || checklists.length === 0) {'));
  assert.ok(src.includes('checklists = await listAllChecklists({ limit: analyticsLimit });'));
  assert.ok(src.includes('fallbackBlockedNotAvailable = true;'));
});
