'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { serverTimestamp } = require('../../infra/firestore');

async function approveNotification(params) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');
  const approvedBy = payload.actor || null;

  const existing = await notificationsRepo.getNotification(notificationId);
  if (!existing) throw new Error('notification not found');
  const status = existing.status || 'draft';
  if (status !== 'draft') throw new Error('notification not editable');

  await notificationsRepo.updateNotificationStatus(notificationId, {
    status: 'active',
    approvedAt: serverTimestamp(),
    approvedBy: approvedBy || null
  });

  return { ok: true, notificationId, status: 'active' };
}

module.exports = {
  approveNotification
};

