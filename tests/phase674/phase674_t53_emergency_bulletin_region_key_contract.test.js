'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalizeRegionKey } = require('../../src/repos/firestore/emergencyBulletinsRepo');

test('phase674: emergency bulletin region key canonicalization preserves STATE::slug contract', () => {
  assert.equal(canonicalizeRegionKey('ny::new-york'), 'NY::new-york');
  assert.equal(canonicalizeRegionKey('Ny::STATEWIDE'), 'NY::statewide');
  assert.equal(canonicalizeRegionKey('NY::Queens'), 'NY::queens');
});
