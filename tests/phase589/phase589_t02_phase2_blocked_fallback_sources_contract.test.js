'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase589: phase2 automation blocked mode exposes bounded fallback source names', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/phase2/runAutomation.js'), 'utf8');
  assert.ok(src.includes("summary.readPath.eventsSource = 'not_available';"));
  assert.ok(src.includes("summary.readPath.userSource = 'not_available';"));
  assert.ok(src.includes("summary.readPath.checklistSource = 'not_available';"));
  assert.ok(src.includes("summary.readPath.userChecklistSource = 'not_available';"));
  assert.ok(src.includes('listUsersByCreatedAtRange:fallback'));
  assert.ok(src.includes('listChecklistsByCreatedAtRange:fallback'));
  assert.ok(src.includes('listUserChecklistsByCreatedAtRange:fallback'));
});

