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

module.exports = {
  computeSegmentRunDeliveryId,
  computeNotificationDeliveryId
};

