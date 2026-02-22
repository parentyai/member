'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback', () => {
  const file = path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('collectLineUserIds(scopedUsers)'));
  assert.ok(src.includes('listUserChecklistsByLineUserIds({'));
  assert.ok(src.includes('lineUserIds: scopedLineUserIds'));
  assert.ok(src.includes('if (userChecklistsResult.failed || userChecklists.length === 0) {'));
  assert.ok(src.includes("addFallbackSource('listAllUserChecklists');"));
  assert.ok(src.includes('fallbackBlockedNotAvailable = true;'));
});

