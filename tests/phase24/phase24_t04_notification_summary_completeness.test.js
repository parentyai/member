'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateNotificationSummaryCompleteness } = require('../../src/usecases/phase24/notificationSummaryCompleteness');

test('phase24 t04: missing linkRegistryId => BLOCK', () => {
  const result = evaluateNotificationSummaryCompleteness({
    ctaText: 'Go',
    linkRegistryId: null,
    deliveredCount: 1,
    readCount: 0,
    clickCount: 0
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('missing_link_registry'));
  assert.strictEqual(result.severity, 'BLOCK');
});

test('phase24 t04: invalid ctaText => BLOCK', () => {
  const result = evaluateNotificationSummaryCompleteness({
    ctaText: '   ',
    linkRegistryId: 'L1',
    deliveredCount: 1,
    readCount: 0,
    clickCount: 0
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('invalid_cta_text'));
  assert.strictEqual(result.severity, 'BLOCK');
});

test('phase24 t04: missing deliveries => WARN', () => {
  const result = evaluateNotificationSummaryCompleteness({
    ctaText: 'Go',
    linkRegistryId: 'L1',
    deliveredCount: 0,
    readCount: 0,
    clickCount: 0
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.missing.includes('missing_deliveries'));
  assert.strictEqual(result.severity, 'WARN');
});

test('phase24 t04: event without delivery => BLOCK', () => {
  const result = evaluateNotificationSummaryCompleteness({
    ctaText: 'Go',
    linkRegistryId: 'L1',
    deliveredCount: 0,
    readCount: 1,
    clickCount: 0
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('event_without_delivery'));
  assert.strictEqual(result.severity, 'BLOCK');
});
