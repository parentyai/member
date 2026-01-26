'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  validateSingleCta,
  validateLinkRequired,
  validateWarnLinkBlock,
  validateKillSwitch,
  validateNotificationPayload
} = require('../../src/domain/validators');

function baseNotification() {
  return {
    ctaText: 'Open',
    linkRegistryId: 'link_1'
  };
}

test('validateSingleCta: accepts single CTA text', () => {
  assert.strictEqual(validateSingleCta(baseNotification()), true);
});

test('validateSingleCta: rejects missing CTA text', () => {
  assert.throws(() => validateSingleCta({ linkRegistryId: 'link_1' }), /CTA text required/);
});

test('validateSingleCta: rejects multiple CTAs', () => {
  assert.throws(
    () => validateSingleCta({ ctaText: 'Open', ctas: ['a', 'b'], linkRegistryId: 'link_1' }),
    /CTA must be exactly 1/
  );
});

test('validateLinkRequired: requires linkRegistryId', () => {
  assert.throws(() => validateLinkRequired({ ctaText: 'Open' }), /linkRegistryId required/);
});

test('validateLinkRequired: rejects direct URL', () => {
  assert.throws(
    () => validateLinkRequired({ ctaText: 'Open', linkRegistryId: 'link_1', url: 'https://x' }),
    /direct URL is forbidden/
  );
});

test('validateWarnLinkBlock: blocks WARN state', () => {
  assert.throws(
    () => validateWarnLinkBlock({ lastHealth: { state: 'WARN' } }),
    /link health WARN/
  );
});

test('validateKillSwitch: blocks when ON', () => {
  assert.throws(() => validateKillSwitch(true), /kill switch is ON/);
  assert.throws(() => validateKillSwitch({ killSwitch: true }), /kill switch is ON/);
});

test('validateNotificationPayload: passes when all checks ok', () => {
  const notification = baseNotification();
  const link = { lastHealth: { state: 'OK' } };
  assert.strictEqual(validateNotificationPayload(notification, link, { killSwitch: false }), true);
});
