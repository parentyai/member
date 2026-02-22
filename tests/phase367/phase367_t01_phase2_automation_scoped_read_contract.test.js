'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase367: phase2 automation prefers scoped reads before listAll fallbacks', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/phase2/runAutomation.js'), 'utf8');
  assert.ok(src.includes('listUsersByLineUserIds'));
  assert.ok(src.includes('listChecklistsByScenarioStepPairs'));
  assert.ok(src.includes('listUserChecklistsByLineUserIds'));
  assert.ok(src.includes('collectLineUserIds(events'));
  assert.ok(src.includes("summary.readPath.userSource = 'scoped'"));
});
