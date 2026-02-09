'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const { getNotificationReactionSummary } = require('../phase137/getNotificationReactionSummary');
const { evaluateNotificationHealth } = require('../phase139/evaluateNotificationHealth');

async function getNotificationReadModel(params) {
  const opts = params || {};
  const notifications = await notificationsRepo.listNotifications({
    limit: opts.limit,
    status: opts.status,
    scenarioKey: opts.scenarioKey,
    stepKey: opts.stepKey
  });

  const items = [];
  for (const notification of notifications) {
    const deliveries = await deliveriesRepo.listDeliveriesByNotificationId(notification.id);
    let deliveredCount = 0;
    let readCount = 0;
    let clickCount = 0;
    for (const delivery of deliveries) {
      deliveredCount += 1;
      if (delivery.readAt) readCount += 1;
      if (delivery.clickAt) clickCount += 1;
    }
    const reaction = await getNotificationReactionSummary({ notificationId: notification.id }, { deliveriesRepo: { listDeliveriesByNotificationId: async () => deliveries } });
    const reactionSummary = {
      sent: reaction.sent,
      clicked: reaction.clicked,
      ctr: reaction.ctr
    };
    const notificationHealth = evaluateNotificationHealth({ sent: reaction.sent, ctr: reaction.ctr });
    const item = {
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      ctaText: notification.ctaText || null,
      linkRegistryId: notification.linkRegistryId || null,
      deliveredCount,
      readCount,
      clickCount,
      reactionSummary,
      notificationHealth
    };
    item.decisionTrace = await getNotificationDecisionTrace(notification.id);
    item.completeness = evaluateNotificationSummaryCompleteness(item);
    items.push(item);
  }

  return items;
}

module.exports = {
  getNotificationReadModel
};
