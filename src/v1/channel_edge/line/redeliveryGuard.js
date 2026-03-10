'use strict';

function isRedeliveryEvent(event) {
  const ctx = event && event.deliveryContext && typeof event.deliveryContext === 'object'
    ? event.deliveryContext
    : null;
  return Boolean(ctx && ctx.isRedelivery === true);
}

function shouldDropByRedelivery(event, dedupeStore, dedupeKey) {
  const store = dedupeStore;
  if (!store || typeof store.isSeen !== 'function') return false;
  if (!isRedeliveryEvent(event)) return false;
  return store.isSeen(dedupeKey, Date.now());
}

async function shouldDropByRedeliveryAsync(event, dedupeStore, dedupeKey) {
  const store = dedupeStore;
  if (!store || typeof store.isSeen !== 'function') return false;
  if (!isRedeliveryEvent(event)) return false;
  try {
    return await Promise.resolve(store.isSeen(dedupeKey, Date.now()));
  } catch (_err) {
    return false;
  }
}

module.exports = {
  isRedeliveryEvent,
  shouldDropByRedelivery,
  shouldDropByRedeliveryAsync
};
