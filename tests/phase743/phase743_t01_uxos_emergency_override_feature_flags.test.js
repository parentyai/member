'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  isUxosEmergencyOverrideEnabled,
  getUxosEmergencyOverrideScanLimit,
  getUxosEmergencyOverrideMaxAgeHours
} = require('../../src/domain/uxos/featureFlags');

test('phase743: uxos emergency override feature flags parse with defaults and bounds', () => {
  const prevEnabled = process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  const prevLimit = process.env.UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT;
  const prevAge = process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS;
  delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  delete process.env.UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT;
  delete process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS;
  try {
    assert.equal(isUxosEmergencyOverrideEnabled(), false);
    assert.equal(getUxosEmergencyOverrideScanLimit(), 120);
    assert.equal(getUxosEmergencyOverrideMaxAgeHours(), 24);
    process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = '1';
    process.env.UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT = '9999';
    process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS = '-1';
    assert.equal(isUxosEmergencyOverrideEnabled(), true);
    assert.equal(getUxosEmergencyOverrideScanLimit(), 120);
    assert.equal(getUxosEmergencyOverrideMaxAgeHours(), 24);
  } finally {
    if (prevEnabled === undefined) delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
    else process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = prevEnabled;
    if (prevLimit === undefined) delete process.env.UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT;
    else process.env.UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT = prevLimit;
    if (prevAge === undefined) delete process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS;
    else process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS = prevAge;
  }
});

test('phase743: ssot index includes uxos emergency override doc', () => {
  const src = fs.readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(src.includes('docs/SSOT_UXOS_EMERGENCY_OVERRIDE_P1_V1.md'));
});
