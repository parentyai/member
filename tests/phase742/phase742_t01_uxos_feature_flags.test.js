'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const featureFlags = require('../../src/domain/tasks/featureFlags');

function withEnv(name, value) {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (prev === undefined) delete process.env[name];
    else process.env[name] = prev;
  };
}

test('phase742: uxos flags default to disabled', () => {
  const restoreEvents = withEnv('ENABLE_UXOS_EVENTS_V1', undefined);
  const restoreNba = withEnv('ENABLE_UXOS_NBA_V1', undefined);
  const restoreFatigue = withEnv('ENABLE_UXOS_FATIGUE_WARN_V1', undefined);
  const restorePolicy = withEnv('ENABLE_UXOS_POLICY_READONLY_V1', undefined);
  try {
    assert.equal(featureFlags.isUxOsEventsEnabled(), false);
    assert.equal(featureFlags.isUxOsNbaEnabled(), false);
    assert.equal(featureFlags.isUxOsFatigueWarnEnabled(), false);
    assert.equal(featureFlags.isUxOsPolicyReadonlyEnabled(), false);
  } finally {
    restoreEvents();
    restoreNba();
    restoreFatigue();
    restorePolicy();
  }
});

test('phase742: uxos flags parse on and off values', () => {
  const restoreEvents = withEnv('ENABLE_UXOS_EVENTS_V1', 'on');
  const restoreNba = withEnv('ENABLE_UXOS_NBA_V1', 'true');
  const restoreFatigue = withEnv('ENABLE_UXOS_FATIGUE_WARN_V1', '1');
  const restorePolicy = withEnv('ENABLE_UXOS_POLICY_READONLY_V1', 'off');
  try {
    assert.equal(featureFlags.isUxOsEventsEnabled(), true);
    assert.equal(featureFlags.isUxOsNbaEnabled(), true);
    assert.equal(featureFlags.isUxOsFatigueWarnEnabled(), true);
    assert.equal(featureFlags.isUxOsPolicyReadonlyEnabled(), false);
  } finally {
    restoreEvents();
    restoreNba();
    restoreFatigue();
    restorePolicy();
  }
});
