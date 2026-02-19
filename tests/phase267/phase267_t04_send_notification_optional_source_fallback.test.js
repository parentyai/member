'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

test('phase267: sendNotification uses cityPackFallback when only optional sources are invalid', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await usersRepo.createUser('U_PHASE267_OPTIONAL', {
      scenarioKey: 'A',
      stepKey: '3mo'
    });
    const primaryLink = await linkRegistryRepo.createLink({
      title: 'Primary Link',
      url: 'https://example.com/primary'
    });
    const fallbackLink = await linkRegistryRepo.createLink({
      title: 'Fallback Link',
      url: 'https://example.com/fallback'
    });
    await sourceRefsRepo.createSourceRef({
      id: 'sr_optional_invalid_267',
      url: 'https://example.com/source-optional-expired',
      status: 'active',
      requiredLevel: 'optional',
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2025-01-02T00:00:00.000Z'
    });

    const notification = await createNotification({
      title: 'City Pack Optional Fallback',
      body: 'Body',
      ctaText: '通常CTA',
      linkRegistryId: primaryLink.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      status: 'active',
      target: { all: true },
      sourceRefs: ['sr_optional_invalid_267'],
      cityPackFallback: {
        fallbackLinkRegistryId: fallbackLink.id,
        fallbackCtaText: '代替CTA'
      }
    });

    let pushCount = 0;
    const result = await sendNotification({
      notificationId: notification.id,
      killSwitch: false,
      pushFn: async () => {
        pushCount += 1;
      }
    });
    assert.strictEqual(pushCount, 1);
    assert.strictEqual(result.fallbackUsed, true);
    assert.strictEqual(result.optionalSourceFailureCount, 1);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase267: sendNotification remains fail-closed when required source is invalid', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await usersRepo.createUser('U_PHASE267_REQUIRED', {
      scenarioKey: 'A',
      stepKey: '3mo'
    });
    const primaryLink = await linkRegistryRepo.createLink({
      title: 'Primary Link',
      url: 'https://example.com/primary-required'
    });
    const fallbackLink = await linkRegistryRepo.createLink({
      title: 'Fallback Link',
      url: 'https://example.com/fallback-required'
    });
    await sourceRefsRepo.createSourceRef({
      id: 'sr_required_invalid_267',
      url: 'https://example.com/source-required-expired',
      status: 'active',
      requiredLevel: 'required',
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2025-01-02T00:00:00.000Z'
    });

    const notification = await createNotification({
      title: 'City Pack Required Block',
      body: 'Body',
      ctaText: '通常CTA',
      linkRegistryId: primaryLink.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      status: 'active',
      target: { all: true },
      sourceRefs: ['sr_required_invalid_267'],
      cityPackFallback: {
        fallbackLinkRegistryId: fallbackLink.id,
        fallbackCtaText: '代替CTA'
      }
    });

    await assert.rejects(
      sendNotification({
        notificationId: notification.id,
        killSwitch: false,
        pushFn: async () => {}
      }),
      (err) => {
        assert.strictEqual(err.blockedReasonCategory, 'SOURCE_EXPIRED');
        return true;
      }
    );
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
