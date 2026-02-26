'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveRegionKeys } = require('../../src/usecases/emergency/regionResolvers');

test('phase669: regionResolver is deterministic and isolates unmapped events', () => {
  const event = {
    regionHints: {
      states: ['tx', 'CA'],
      cities: ['Austin'],
      fips: ['06001', '48453'],
      coordinates: [-97.74, 30.27]
    }
  };

  const first = resolveRegionKeys(event);
  const second = resolveRegionKeys(event);

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.deepEqual(first.regionKeys, ['CA::austin', 'TX::austin']);

  const unmapped = resolveRegionKeys({
    regionHints: {
      states: [],
      cities: [],
      fips: [],
      coordinates: [-120.0, 35.0]
    }
  });
  assert.equal(unmapped.ok, false);
  assert.equal(unmapped.reason, 'region_unresolved');
});

