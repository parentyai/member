'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateFatigueWarning } = require('../../src/usecases/uxos/evaluateFatigueWarning');

test('phase742: fatigue warning stays warn-only when threshold is exceeded', () => {
  const prev = process.env.ENABLE_UXOS_FATIGUE_WARN;
  process.env.ENABLE_UXOS_FATIGUE_WARN = '1';
  try {
    const result = evaluateFatigueWarning({
      recipientCount: 100,
      capBlockedCount: 40
    });
    assert.equal(result.enabled, true);
    assert.equal(result.warn, true);
    assert.ok(Array.isArray(result.warnings));
    assert.ok(result.warnings.some((row) => row.code === 'high_blocked_rate'));
    assert.ok(result.metrics.capBlockedRate >= 0.25);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN;
    else process.env.ENABLE_UXOS_FATIGUE_WARN = prev;
  }
});

test('phase742: fatigue warning disabled state does not emit warnings', () => {
  const prev = process.env.ENABLE_UXOS_FATIGUE_WARN;
  process.env.ENABLE_UXOS_FATIGUE_WARN = '0';
  try {
    const result = evaluateFatigueWarning({
      recipientCount: 100,
      capBlockedCount: 90
    });
    assert.equal(result.enabled, false);
    assert.equal(result.warn, false);
    assert.deepEqual(result.warnings, []);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN;
    else process.env.ENABLE_UXOS_FATIGUE_WARN = prev;
  }
});
