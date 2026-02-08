'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const noticesRepo = require('../../repos/firestore/noticesRepo');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');

function toNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

async function getOpsDashboard(params, deps) {
  const payload = params || {};
  const limit = toNumber(payload.limit, 20);

  const users = deps && deps.usersRepo ? deps.usersRepo : usersRepo;
  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const notices = deps && deps.noticesRepo ? deps.noticesRepo : noticesRepo;
  const decisions = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;

  const userList = await users.listUsers({ limit });
  const activeNotices = await notices.listNotices({ status: 'active', limit: 20 });

  const items = [];
  for (const user of userList) {
    const lineUserId = user.id;
    const deliveryList = await deliveries.listDeliveriesByUser(lineUserId, 5);
    const lastDelivery = deliveryList.length ? deliveryList[0] : null;
    const lastNoticeSent = deliveryList.find((item) => item && item.noticeId) || null;
    const latestDecisionLog = await decisions.getLatestDecision('user', lineUserId);
    items.push({
      lineUserId,
      memberNumber: user.memberNumber || null,
      lastDelivery: lastDelivery || null,
      lastNoticeSent: lastNoticeSent || null,
      latestDecisionLog: latestDecisionLog || null
    });
  }

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    items,
    activeNotices
  };
}

module.exports = {
  getOpsDashboard
};
