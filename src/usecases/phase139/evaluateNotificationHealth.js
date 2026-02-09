'use strict';

function requireNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} required`);
  return value;
}

function evaluateNotificationHealth(params) {
  const payload = params || {};
  const sent = requireNumber(payload.sent, 'sent');
  const ctr = requireNumber(payload.ctr, 'ctr');

  if (sent >= 30 && ctr < 0.05) return 'DANGER';
  if (sent >= 30 && ctr < 0.15) return 'WARN';
  return 'OK';
}

module.exports = {
  evaluateNotificationHealth
};

