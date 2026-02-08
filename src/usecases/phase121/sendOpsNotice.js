'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const lineClient = require('../../infra/lineClient');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

async function sendOpsNotice(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const text = requireString(payload.text, 'text');
  const decidedBy = requireString(payload.decidedBy || 'ops', 'decidedBy');
  const notificationId = payload.sourceNotificationId || null;

  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const pushFn = deps && deps.pushMessage ? deps.pushMessage : lineClient.pushMessage;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    return { ok: false, reason: 'kill_switch_on', status: 409 };
  }

  await pushFn(lineUserId, { type: 'text', text });

  const delivery = await deliveries.createDelivery({
    lineUserId,
    notificationId,
    text,
    decidedBy
  });

  const audit = await auditRepo.appendAuditLog({
    action: 'OPS_NOTICE_SENT',
    eventType: 'OPS_NOTICE_SENT',
    type: 'OPS_NOTICE_SENT',
    lineUserId,
    notificationId,
    text,
    decidedBy
  });

  return {
    ok: true,
    deliveryId: delivery.id,
    auditId: audit.id
  };
}

module.exports = {
  sendOpsNotice
};
