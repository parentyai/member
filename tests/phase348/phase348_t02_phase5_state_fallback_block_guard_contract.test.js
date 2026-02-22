'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase348: phase5 state summary guards listAll fallback when fallbackMode is block', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;"));
  assert.ok(src.includes('if (events.length === 0 && !fallbackBlocked) {'));
  assert.ok(src.includes('if (deliveries.length === 0 && !fallbackBlocked) {'));
  assert.ok(src.includes('if (userChecklistsResult.failed && !fallbackBlocked) {'));
  assert.ok(src.includes("dataSource: fallbackBlockedNotAvailable ? 'not_available' : 'computed'"));
});
