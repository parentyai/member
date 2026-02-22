'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase352: phase4 user operational summary prefers checklist scoped read path', () => {
  const file = path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('listChecklistsByScenarioAndStep'));
  assert.ok(src.includes('collectScenarioStepPairs(scopedUsers)'));
  assert.ok(src.includes('checklistsPromise'));
  assert.ok(src.includes('if (checklistsResult.failed || checklists.length === 0) {'));
  assert.ok(
    src.includes('checklists = await listAllChecklists({ limit: analyticsLimit });') ||
      src.includes('checklists = await listChecklistsByCreatedAtRange({ limit: analyticsLimit });')
  );
});
