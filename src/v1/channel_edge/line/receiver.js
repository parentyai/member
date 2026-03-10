'use strict';

const { buildWebhookEventDedupeKey } = require('./dedupeStore');
const { shouldDropByRedelivery, shouldDropByRedeliveryAsync } = require('./redeliveryGuard');
const { shouldDropByOrdering } = require('./orderingGuard');

function filterWebhookEvents(events, options) {
  const payload = Array.isArray(events) ? events : [];
  const dedupeStore = options && options.dedupeStore ? options.dedupeStore : null;
  const accepted = [];
  const dropped = [];

  payload.forEach((event) => {
    const dedupeKey = buildWebhookEventDedupeKey(event);
    if (dedupeStore && typeof dedupeStore.isSeen === 'function' && dedupeStore.isSeen(dedupeKey, Date.now())) {
      dropped.push({ reason: 'duplicate_event', dedupeKey, event });
      return;
    }
    if (shouldDropByRedelivery(event, dedupeStore, dedupeKey)) {
      dropped.push({ reason: 'redelivery_duplicate', dedupeKey, event });
      return;
    }
    if (shouldDropByOrdering(event, options)) {
      dropped.push({ reason: 'out_of_order', dedupeKey, event });
      return;
    }

    accepted.push(event);
    if (dedupeStore && typeof dedupeStore.markSeen === 'function') dedupeStore.markSeen(dedupeKey, Date.now());
  });

  return {
    accepted,
    dropped
  };
}

async function filterWebhookEventsAsync(events, options) {
  const payload = Array.isArray(events) ? events : [];
  const dedupeStore = options && options.dedupeStore ? options.dedupeStore : null;
  const orderingStore = options && options.orderingStore ? options.orderingStore : null;
  const accepted = [];
  const dropped = [];

  for (const event of payload) {
    const dedupeKey = buildWebhookEventDedupeKey(event);
    const seen = dedupeStore && typeof dedupeStore.isSeen === 'function'
      ? await Promise.resolve(dedupeStore.isSeen(dedupeKey, Date.now())).catch(() => false)
      : false;
    if (seen) {
      dropped.push({ reason: 'duplicate_event', dedupeKey, event });
      continue;
    }
    if (await shouldDropByRedeliveryAsync(event, dedupeStore, dedupeKey)) {
      dropped.push({ reason: 'redelivery_duplicate', dedupeKey, event });
      continue;
    }
    const outOfOrder = orderingStore && typeof orderingStore.shouldDropByOrdering === 'function'
      ? await Promise.resolve(orderingStore.shouldDropByOrdering(event, options)).catch(() => false)
      : shouldDropByOrdering(event, options);
    if (outOfOrder) {
      dropped.push({ reason: 'out_of_order', dedupeKey, event });
      continue;
    }
    accepted.push(event);
    if (dedupeStore && typeof dedupeStore.markSeen === 'function') {
      await Promise.resolve(dedupeStore.markSeen(dedupeKey, Date.now())).catch(() => null);
    }
  }

  return {
    accepted,
    dropped
  };
}

module.exports = {
  filterWebhookEvents,
  filterWebhookEventsAsync
};
