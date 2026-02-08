'use strict';

const DEFAULTS = {
  baseMs: 200,
  factor: 2,
  jitter: 0.1,
  maxRetries: 3
};

function isRetryable(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || error.responseStatus);
  if ([429, 500, 503].includes(status)) return true;
  const code = typeof error.code === 'string' ? error.code : '';
  if (['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code)) return true;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (message.includes('timeout')) return true;
  return false;
}

function createRetryPolicy(options) {
  const opts = Object.assign({}, DEFAULTS, options || {});
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;

  function shouldRetry(error, attempt) {
    if (!isRetryable(error)) return false;
    return attempt < opts.maxRetries;
  }

  function getDelayMs(attempt) {
    const jitterFactor = 1 + (randomFn() * 2 - 1) * opts.jitter;
    return Math.max(0, Math.round(opts.baseMs * Math.pow(opts.factor, attempt) * jitterFactor));
  }

  return {
    shouldRetry,
    getDelayMs,
    maxRetries: opts.maxRetries
  };
}

module.exports = {
  isRetryable,
  createRetryPolicy
};
