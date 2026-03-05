'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  normalizeEducationFields,
  ALLOWED_INTENT_TAG,
  ALLOWED_AUDIENCE_TAG,
  ALLOWED_REGION_SCOPE,
  ALLOWED_RISK_LEVEL
} = require('../../src/repos/firestore/linkRegistryRepo');

test('phase740: link registry v2 keeps legacy compatible and normalizes intent tags', () => {
  const normalized = normalizeEducationFields({
    intentTag: 'task',
    audienceTag: 'family',
    regionScope: 'city',
    riskLevel: 'safe'
  }, { strictIntentValidation: true });

  assert.equal(normalized.intentTag, 'task');
  assert.equal(normalized.audienceTag, 'family');
  assert.equal(normalized.regionScope, 'city');
  assert.equal(normalized.riskLevel, 'safe');
});

test('phase740: invalid intent tags are rejected with 422-ready errors when strict', () => {
  assert.throws(
    () => normalizeEducationFields({ intentTag: 'unknown_tag' }, { strictIntentValidation: true }),
    (err) => err && err.statusCode === 422 && err.code === 'intentTag_invalid'
  );
  assert.throws(
    () => normalizeEducationFields({ audienceTag: 'x' }, { strictIntentValidation: true }),
    (err) => err && err.statusCode === 422 && err.code === 'audienceTag_invalid'
  );
  assert.throws(
    () => normalizeEducationFields({ regionScope: 'metro' }, { strictIntentValidation: true }),
    (err) => err && err.statusCode === 422 && err.code === 'regionScope_invalid'
  );
  assert.throws(
    () => normalizeEducationFields({ riskLevel: 'critical' }, { strictIntentValidation: true }),
    (err) => err && err.statusCode === 422 && err.code === 'riskLevel_invalid'
  );
});

test('phase740: allowed sets are explicit for admin validation', () => {
  assert.ok(ALLOWED_INTENT_TAG.has('task'));
  assert.ok(ALLOWED_AUDIENCE_TAG.has('family'));
  assert.ok(ALLOWED_REGION_SCOPE.has('school_district'));
  assert.ok(ALLOWED_RISK_LEVEL.has('blocked'));
});
