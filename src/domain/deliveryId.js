'use strict';

const crypto = require('crypto');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function shortenHex(hex, length) {
  const n = typeof length === 'number' ? length : 32;
  return String(hex).slice(0, Math.max(8, Math.min(64, n)));
}

function computeSegmentRunDeliveryId(params) {
  const payload = params || {};
  const runId = requireString(payload.runId, 'runId');
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  return `seg_${shortenHex(sha256Hex(`segment_run:${runId}:${lineUserId}`), 32)}`;
}

function computeNotificationDeliveryId(params) {
  const payload = params || {};
  const notificationId = requireString(payload.notificationId, 'notificationId');
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  return `ntf_${shortenHex(sha256Hex(`notification:${notificationId}:${lineUserId}`), 32)}`;
}

function computeLineRetryKey(params) {
  const payload = params || {};
  const deliveryId = requireString(payload.deliveryId, 'deliveryId');
  // LINE Messaging API expects a UUID-formatted retry key.
  // Derive a deterministic UUID from deliveryId (sha256) to keep retries idempotent.
  const hex = sha256Hex(`line_retry:${deliveryId}`);
  const bytes = Buffer.from(hex.slice(0, 32), 'hex'); // 16 bytes
  // Set UUID version (4) + variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const b = bytes.toString('hex');
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20, 32)}`;
}

module.exports = {
  computeSegmentRunDeliveryId,
  computeNotificationDeliveryId,
  computeLineRetryKey
};
