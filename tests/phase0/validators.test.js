'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  validateSingleCta,
  validateLinkRequired,
  validateCtaStructure,
  resolveNotificationCtas,
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

test('validateCtaStructure: accepts up to 3 CTAs (primary + secondary2)', () => {
  const notification = {
    ctaText: 'Open',
    linkRegistryId: 'link_1',
    secondaryCtas: [
      { ctaText: 'More', linkRegistryId: 'link_2' },
      { ctaText: 'FAQ', linkRegistryId: 'link_3' }
    ]
  };
  assert.strictEqual(validateCtaStructure(notification), true);
  const slots = resolveNotificationCtas(notification);
  assert.deepStrictEqual(
    slots.map((slot) => slot.slot),
    ['primary', 'secondary1', 'secondary2']
  );
});

test('validateCtaStructure: rejects over max secondary', () => {
  const notification = {
    ctaText: 'Open',
    linkRegistryId: 'link_1',
    secondaryCtas: [
      { ctaText: 'More', linkRegistryId: 'link_2' },
      { ctaText: 'FAQ', linkRegistryId: 'link_3' },
      { ctaText: 'Docs', linkRegistryId: 'link_4' }
    ]
  };
  assert.throws(() => validateCtaStructure(notification), /secondary CTA must be <= 2/);
});

test('validateCtaStructure: rejects duplicate CTA labels (case-insensitive)', () => {
  const notification = {
    ctaText: 'Open',
    linkRegistryId: 'link_1',
    secondaryCtas: [
      { ctaText: 'open', linkRegistryId: 'link_2' }
    ]
  };
  assert.throws(() => validateCtaStructure(notification), /CTA labels must be unique/);
});

test('validateCtaStructure: rejects direct URL in secondary linkRegistryId', () => {
  const notification = {
    ctaText: 'Open',
    linkRegistryId: 'link_1',
    secondaryCtas: [
      { ctaText: 'More', linkRegistryId: 'https://example.com/direct' }
    ]
  };
  assert.throws(() => validateCtaStructure(notification), /direct URL is forbidden/);
});

test('resolveNotificationCtas: keeps legacy single CTA when secondary is ignored', () => {
  const notification = {
    ctaText: 'Open',
    linkRegistryId: 'link_1',
    secondaryCtas: [{ ctaText: 'More', linkRegistryId: 'link_2' }]
  };
  const slots = resolveNotificationCtas(notification, {
    allowSecondary: false,
    ignoreSecondary: true,
    minTotal: 1,
    maxSecondary: 0,
    maxTotal: 1
  });
  assert.strictEqual(slots.length, 1);
  assert.strictEqual(slots[0].slot, 'primary');
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
