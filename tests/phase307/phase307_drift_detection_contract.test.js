'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase307: canonical user query path does not reintroduce scenario-field filtering', () => {
  const source = readFileSync('src/repos/firestore/usersRepo.js', 'utf8');
  assert.ok(source.includes('normalizeScenarioKey'), 'usersRepo should normalize scenario inputs');
  assert.ok(!source.includes("where('scenario',"), 'usersRepo must not query legacy scenario field directly');
});

test('phase307: ops review flow normalizes drift fields before writing', () => {
  const source = readFileSync('src/usecases/phase5/setOpsReview.js', 'utf8');
  assert.ok(source.includes('normalizeOpsStateRecord'), 'setOpsReview usecase must normalize payload');
});
