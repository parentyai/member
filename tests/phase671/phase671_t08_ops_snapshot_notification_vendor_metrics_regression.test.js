'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  getDb
} = require('../../src/infra/firestore');
const { computeOpsSystemSnapshot } = require('../../src/usecases/admin/opsSnapshot/computeOpsSystemSnapshot');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('phase671: notification type metrics resolve wrapper document id', async () => {
  const db = getDb();
  const now = new Date();

  await db.collection('notifications').doc('notif_wrapper_only').set({
    notificationType: 'ANNOUNCEMENT',
    status: 'sent',
    createdAt: now,
    updatedAt: now
  });
  await db.collection('notification_deliveries').doc('delivery_wrapper_only').set({
    notificationId: 'notif_wrapper_only',
    sentAt: now,
    delivered: true,
    state: 'DELIVERED',
    createdAt: now,
    updatedAt: now
  });

  const snapshot = await computeOpsSystemSnapshot({ scanLimit: 200 });
  const noticeRow = snapshot.rows.find((row) => row.featureId === 'notice_notification');
  assert.ok(noticeRow);
  assert.equal(noticeRow.status, 'OK');
  assert.equal(noticeRow.metrics.deliveryCount, 1);
});

test('phase671: vendor_hub counts links from vendorKey and vendor title marker', async () => {
  const db = getDb();
  const now = new Date();

  await db.collection('link_registry').doc('vendor_link_1').set({
    title: '[SEED][VENDOR_LINK] official vendor',
    vendorKey: 'acme_vendor',
    vendorLabel: 'Acme Vendor',
    category: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    lastHealth: {
      state: 'OK',
      checkedAt: now
    }
  });

  const snapshot = await computeOpsSystemSnapshot({ scanLimit: 200 });
  const vendorRow = snapshot.rows.find((row) => row.featureId === 'vendor_hub');
  assert.ok(vendorRow);
  assert.equal(vendorRow.status, 'OK');
  assert.equal(vendorRow.metrics.totalVendorLinks, 1);
});
