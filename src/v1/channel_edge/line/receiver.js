'use strict';

const { buildWebhookEventDedupeKey } = require('./dedupeStore');
const { shouldDropByRedelivery } = require('./redeliveryGuard');
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

module.exports = {
  filterWebhookEvents
};
