'use strict';

class InMemoryWebhookDedupeStore {
  constructor(ttlMs) {
    this.ttlMs = Number.isFinite(Number(ttlMs)) ? Math.max(60000, Math.floor(Number(ttlMs))) : 24 * 60 * 60 * 1000;
    this.map = new Map();
  }

  purge(nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    for (const [key, expireAt] of this.map.entries()) {
      if (expireAt <= now) this.map.delete(key);
    }
  }

  markSeen(key, nowMs) {
    if (!key) return;
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    this.map.set(key, now + this.ttlMs);
  }

  isSeen(key, nowMs) {
    if (!key) return false;
    this.purge(nowMs);
    return this.map.has(key);
  }
}

function buildWebhookEventDedupeKey(event) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : {};
  const sourceType = typeof source.type === 'string' ? source.type : 'unknown';
  const sourceId = source.userId || source.groupId || source.roomId || 'unknown';
  const webhookEventId = typeof event.webhookEventId === 'string' && event.webhookEventId.trim()
    ? event.webhookEventId.trim()
    : null;
  if (webhookEventId) return `line:${webhookEventId}`;
  const timestamp = Number.isFinite(Number(event && event.timestamp)) ? Number(event.timestamp) : 0;
  const eventType = typeof event && typeof event.type === 'string' ? event.type : 'unknown';
  const messageId = event && event.message && typeof event.message.id === 'string' ? event.message.id : '';
  const replyToken = event && typeof event.replyToken === 'string' ? event.replyToken : '';
  return `line:fallback:${sourceType}:${sourceId}:${eventType}:${timestamp}:${messageId}:${replyToken}`;
}

module.exports = {
  InMemoryWebhookDedupeStore,
  buildWebhookEventDedupeKey
};
