'use strict';

function normalizeToken(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, '_').slice(0, 512);
}

function reportSuppressedError(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const scope = normalizeToken(payload.scope || 'unknown_scope') || 'unknown_scope';
  const stage = normalizeToken(payload.stage || 'unknown_stage') || 'unknown_stage';
  const traceId = normalizeToken(payload.traceId || '');
  const requestId = normalizeToken(payload.requestId || '');
  const actor = normalizeToken(payload.actor || '');
  const lineUserId = normalizeToken(payload.lineUserId || '');
  const notificationId = normalizeToken(payload.notificationId || '');
  const deliveryId = normalizeToken(payload.deliveryId || '');
  const name = normalizeToken(payload.err && payload.err.name ? payload.err.name : 'Error');
  const message = normalizeToken(payload.err && payload.err.message ? payload.err.message : 'error');

  const parts = [
    '[suppressed_error]',
    `scope=${scope}`,
    `stage=${stage}`,
    `name=${name}`,
    `message=${message}`
  ];
  if (traceId) parts.push(`traceId=${traceId}`);
  if (requestId) parts.push(`requestId=${requestId}`);
  if (actor) parts.push(`actor=${actor}`);
  if (lineUserId) parts.push(`lineUserId=${lineUserId}`);
  if (notificationId) parts.push(`notificationId=${notificationId}`);
  if (deliveryId) parts.push(`deliveryId=${deliveryId}`);

  console.warn(parts.join(' '));
}

module.exports = {
  reportSuppressedError
};
