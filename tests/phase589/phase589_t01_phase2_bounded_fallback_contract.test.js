'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase589: phase2 automation uses bounded fallback paths instead of listAll callsites', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/phase2/runAutomation.js'), 'utf8');

  assert.ok(src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listUsersByCreatedAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listChecklistsByCreatedAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listUserChecklistsByCreatedAtRange:fallback');"));

  assert.ok(!src.includes('listAllEvents({ limit: resolvedAnalyticsLimit })'));
  assert.ok(!src.includes('listAllUsers({ limit: resolvedAnalyticsLimit })'));
  assert.ok(!src.includes('listAllChecklists({ limit: resolvedAnalyticsLimit })'));
  assert.ok(!src.includes('listAllUserChecklists({ limit: resolvedAnalyticsLimit })'));
});

