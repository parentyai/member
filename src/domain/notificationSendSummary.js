'use strict';

function toCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function resolveTotalRecipients(base, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const explicitTotal = toCount(opts.totalRecipients);
  if (explicitTotal > 0) return explicitTotal;
  const computed = toCount(base.deliveredCount) + toCount(base.skippedCount) + toCount(base.failedCount);
  return computed;
}

function buildNotificationSendSummary(result, options) {
  const row = result && typeof result === 'object' ? result : {};
  const deliveredCount = toCount(row.deliveredCount);
  const skippedCount = toCount(row.skippedCount);
  const failedCount = toCount(row.failedCount);
  const totalRecipients = resolveTotalRecipients({
    deliveredCount,
    skippedCount,
    failedCount
  }, options);
  const attemptedRecipients = toCount(totalRecipients - skippedCount);
  const partialFailure = row.partialFailure === true || failedCount > 0;
  const status = partialFailure ? 'completed_with_failures' : 'completed';
  const reason = partialFailure ? 'send_partial_failure' : 'ok';
  return {
    status,
    partialFailure,
    reason,
    totalRecipients,
    attemptedRecipients,
    deliveredCount,
    skippedCount,
    failedCount
  };
}

function attachNotificationSendSummary(result, options) {
  const row = result && typeof result === 'object' ? result : {};
  const next = Object.assign({}, row);
  if (next.sendSummary && typeof next.sendSummary === 'object') return next;
  next.sendSummary = buildNotificationSendSummary(next, options);
  return next;
}

module.exports = {
  attachNotificationSendSummary,
  buildNotificationSendSummary
};
