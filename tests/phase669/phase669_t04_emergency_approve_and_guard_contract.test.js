'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const emergencyBulletinsRepo = require('../../src/repos/firestore/emergencyBulletinsRepo');
const { approveEmergencyBulletin } = require('../../src/usecases/emergency/approveEmergencyBulletin');
const {
  validateSingleCta,
  validateLinkRequired,
  validateWarnLinkBlock,
  validateKillSwitch
} = require('../../src/domain/validators');

test('phase669: approve fan-out sends 16 notifications and transitions bulletin to sent', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const link = await linkRegistryRepo.createLink({
    title: 'Emergency official',
    url: 'https://example.gov/emergency',
    domainClass: 'gov'
  });

  await emergencyBulletinsRepo.createBulletin({
    id: 'emb_phase669_send',
    status: 'draft',
    providerKey: 'nws_alerts',
    regionKey: 'TX::statewide',
    category: 'weather',
    severity: 'CRITICAL',
    headline: 'Critical weather alert',
    linkRegistryId: link.id,
    messageDraft: 'message',
    evidenceRefs: { snapshotId: 'snap_1', diffId: 'diff_1' },
    traceId: 'trace_phase669_send'
  });

  const created = [];
  const sent = [];
  const result = await approveEmergencyBulletin({
    bulletinId: 'emb_phase669_send',
    actor: 'phase669_admin',
    traceId: 'trace_phase669_send'
  }, {
    getKillSwitch: async () => false,
    createNotification: async (payload) => {
      created.push(payload);
      return { id: `n_phase669_${created.length}` };
    },
    sendNotification: async (payload) => {
      sent.push(payload);
      return { deliveredCount: 1, skippedCount: 0 };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(created.length, 16);
  assert.equal(sent.length, 16);
  assert.equal(result.notificationIds.length, 16);

  const bulletin = await emergencyBulletinsRepo.getBulletin('emb_phase669_send');
  assert.equal(bulletin.status, 'sent');
  assert.equal(Array.isArray(bulletin.notificationIds), true);
  assert.equal(bulletin.notificationIds.length, 16);
});

test('phase669: approve is blocked by kill switch / WARN link / missing link id', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const safeLink = await linkRegistryRepo.createLink({
    title: 'Emergency safe',
    url: 'https://example.gov/safe',
    domainClass: 'gov'
  });

  await emergencyBulletinsRepo.createBulletin({
    id: 'emb_phase669_block_kill',
    status: 'draft',
    regionKey: 'TX::statewide',
    category: 'alert',
    severity: 'CRITICAL',
    linkRegistryId: safeLink.id,
    messageDraft: 'message',
    evidenceRefs: { diffId: 'diff_kill' },
    traceId: 'trace_phase669_block_kill'
  });

  let createCount = 0;
  const blockedByKill = await approveEmergencyBulletin({
    bulletinId: 'emb_phase669_block_kill',
    actor: 'phase669_admin',
    traceId: 'trace_phase669_block_kill'
  }, {
    getKillSwitch: async () => true,
    createNotification: async () => {
      createCount += 1;
      return { id: 'never' };
    },
    sendNotification: async () => ({ deliveredCount: 1 })
  });
  assert.equal(blockedByKill.ok, false);
  assert.equal(blockedByKill.blocked, true);
  assert.equal(blockedByKill.reason, 'kill_switch_on');
  assert.equal(createCount, 0);

  const warnLink = await linkRegistryRepo.createLink({
    title: 'Emergency warn',
    url: 'https://example.gov/warn',
    domainClass: 'gov'
  });
  await linkRegistryRepo.setHealth(warnLink.id, {
    state: 'WARN',
    checkedAt: '2026-02-26T00:00:00.000Z'
  });
  await emergencyBulletinsRepo.createBulletin({
    id: 'emb_phase669_block_warn',
    status: 'draft',
    regionKey: 'TX::statewide',
    category: 'alert',
    severity: 'CRITICAL',
    linkRegistryId: warnLink.id,
    messageDraft: 'message',
    evidenceRefs: { diffId: 'diff_warn' },
    traceId: 'trace_phase669_block_warn'
  });
  const blockedByWarn = await approveEmergencyBulletin({
    bulletinId: 'emb_phase669_block_warn',
    actor: 'phase669_admin',
    traceId: 'trace_phase669_block_warn'
  }, {
    getKillSwitch: async () => false
  });
  assert.equal(blockedByWarn.ok, false);
  assert.equal(blockedByWarn.reason, 'GUARD_BLOCK_WARN_LINK');

  await emergencyBulletinsRepo.createBulletin({
    id: 'emb_phase669_block_missing_link',
    status: 'draft',
    regionKey: 'TX::statewide',
    category: 'alert',
    severity: 'CRITICAL',
    linkRegistryId: null,
    messageDraft: 'message',
    evidenceRefs: { diffId: 'diff_missing' },
    traceId: 'trace_phase669_block_missing_link'
  });
  const missingLink = await approveEmergencyBulletin({
    bulletinId: 'emb_phase669_block_missing_link',
    actor: 'phase669_admin',
    traceId: 'trace_phase669_block_missing_link'
  }, {
    getKillSwitch: async () => false
  });
  assert.equal(missingLink.ok, false);
  assert.equal(missingLink.reason, 'MISSING_LINK_REGISTRY_ID');
});

test('phase669: validators enforce CTA=1, link_registry required, WARN and kill switch blocks', () => {
  assert.throws(() => {
    validateSingleCta({
      ctaText: 'ok',
      ctas: [{ text: 'a' }, { text: 'b' }]
    });
  });
  assert.throws(() => {
    validateLinkRequired({
      linkRegistryId: 'lr_1',
      url: 'https://direct.example.com'
    });
  });
  assert.throws(() => {
    validateWarnLinkBlock({
      lastHealth: { state: 'WARN' }
    });
  });
  assert.throws(() => {
    validateKillSwitch(true);
  });
});

