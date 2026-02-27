'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  STATUS_OK,
  STATUS_WARN,
  STATUS_ALERT,
  STATUS_UNKNOWN,
  REASON_CODES,
  evaluateRateStatus,
  evaluateAgeStatus,
  buildStatusEnvelope
} = require('../../src/usecases/admin/opsSnapshot/statusRules');

test('phase671: rate and age status thresholds follow OK/WARN/ALERT/UNKNOWN taxonomy', () => {
  const rateOk = evaluateRateStatus(0.005, 1, 5);
  assert.equal(rateOk.status, STATUS_OK);
  assert.deepEqual(rateOk.reasonCodes, []);

  const rateWarn = evaluateRateStatus(0.02, 1, 5);
  assert.equal(rateWarn.status, STATUS_WARN);
  assert.ok(rateWarn.reasonCodes.includes(REASON_CODES.THRESHOLD_WARN));

  const rateAlert = evaluateRateStatus(0.07, 1, 5);
  assert.equal(rateAlert.status, STATUS_ALERT);
  assert.ok(rateAlert.reasonCodes.includes(REASON_CODES.THRESHOLD_ALERT));

  const rateUnknown = evaluateRateStatus(undefined, 1, 5);
  assert.equal(rateUnknown.status, STATUS_UNKNOWN);
  assert.ok(rateUnknown.reasonCodes.includes(REASON_CODES.DATA_MISSING));

  const ageWarn = evaluateAgeStatus(1200, 600, 1800);
  assert.equal(ageWarn.status, STATUS_WARN);
  assert.ok(ageWarn.reasonCodes.includes(REASON_CODES.DATA_STALE));
  assert.ok(ageWarn.reasonCodes.includes(REASON_CODES.THRESHOLD_WARN));

  const ageAlert = evaluateAgeStatus(5400, 1800, 5400);
  assert.equal(ageAlert.status, STATUS_ALERT);
  assert.ok(ageAlert.reasonCodes.includes(REASON_CODES.DATA_STALE));
  assert.ok(ageAlert.reasonCodes.includes(REASON_CODES.THRESHOLD_ALERT));

  const ageUnknown = evaluateAgeStatus(undefined, 600, 1800);
  assert.equal(ageUnknown.status, STATUS_UNKNOWN);
  assert.ok(ageUnknown.reasonCodes.includes(REASON_CODES.DATA_MISSING));
});

test('phase671: status envelope normalizes color and staleness fields', () => {
  const envelope = buildStatusEnvelope({
    nowIso: '2026-02-27T12:10:00.000Z',
    updatedAt: '2026-02-27T12:00:00.000Z',
    lastUpdatedAt: '2026-02-27T12:05:00.000Z',
    status: STATUS_WARN,
    reasonCodes: [REASON_CODES.THRESHOLD_WARN, REASON_CODES.THRESHOLD_WARN],
    computedWindow: {
      fromAt: '2026-02-27T11:00:00.000Z',
      toAt: '2026-02-27T12:10:00.000Z',
      mode: 'bounded'
    }
  });

  assert.equal(envelope.status, STATUS_WARN);
  assert.equal(envelope.statusColor, 'yellow');
  assert.deepEqual(envelope.reasonCodes, [REASON_CODES.THRESHOLD_WARN]);
  assert.equal(envelope.updatedAt, '2026-02-27T12:00:00.000Z');
  assert.equal(envelope.lastUpdatedAt, '2026-02-27T12:05:00.000Z');
  assert.equal(envelope.stalenessSeconds, 300);
  assert.equal(envelope.computedWindow.mode, 'bounded');
});
