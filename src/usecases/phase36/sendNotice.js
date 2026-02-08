'use strict';

const noticesRepo = require('../../repos/firestore/noticesRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const lineClient = require('../../infra/lineClient');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function formatNoticeText(notice) {
  if (!notice) return '';
  const title = typeof notice.title === 'string' ? notice.title.trim() : '';
  const body = typeof notice.body === 'string' ? notice.body.trim() : '';
  if (title && body) return `${title}\n\n${body}`;
  return title || body;
}

async function sendNotice(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const noticeId = requireString(payload.noticeId, 'noticeId');
  const decidedBy = requireString(payload.decidedBy || 'ops', 'decidedBy');

  const notices = deps && deps.noticesRepo ? deps.noticesRepo : noticesRepo;
  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const pushFn = deps && deps.pushMessage ? deps.pushMessage : lineClient.pushMessage;

  const notice = await notices.getNotice(noticeId);
  if (!notice) throw new Error('notice not found');
  if (notice.status !== 'active') throw new Error('notice not active');
  const text = formatNoticeText(notice);
  if (!text) throw new Error('notice text required');

  await pushFn(lineUserId, { type: 'text', text });

  const delivery = await deliveries.createDelivery({
    lineUserId,
    notificationId: null,
    noticeId,
    delivered: true,
    text,
    decidedBy
  });

  const audit = await auditRepo.appendAuditLog({
    action: 'NOTICE_SENT',
    eventType: 'NOTICE_SENT',
    type: 'NOTICE_SENT',
    lineUserId,
    noticeId,
    decidedBy
  });

  return {
    ok: true,
    deliveryId: delivery.id,
    auditId: audit.id
  };
}

module.exports = {
  sendNotice
};
