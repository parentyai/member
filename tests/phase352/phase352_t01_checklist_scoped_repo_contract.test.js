'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase352: analytics read repo exposes checklist scoped query by scenario+step', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/analyticsReadRepo.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('async function listChecklistsByScenarioAndStep(opts)'));
  assert.ok(src.includes(".where('scenario', '==', scenario)"));
  assert.ok(src.includes(".where('step', '==', step)"));
  assert.ok(src.includes('listChecklistsByScenarioAndStep,'));
});
