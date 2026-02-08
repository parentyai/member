'use strict';

function classifyStatus(error) {
  const status = Number(error && (error.status || error.statusCode || error.responseStatus));
  if (status === 429) return '429';
  if (status >= 500) return '5xx';
  return null;
}

function createCircuitBreaker(options) {
  const opts = options || {};
  const windowSize = Number.isFinite(opts.windowSize) ? opts.windowSize : 10;
  const max429 = Number.isFinite(opts.max429) ? opts.max429 : 7;
  const max5xx = Number.isFinite(opts.max5xx) ? opts.max5xx : 7;
  const window = [];

  function record(error) {
    const kind = classifyStatus(error);
    window.push(kind || 'ok');
    if (window.length > windowSize) window.shift();
    const count429 = window.filter((item) => item === '429').length;
    const count5xx = window.filter((item) => item === '5xx').length;
    if (count429 >= max429) {
      return { aborted: true, reason: 'circuit_breaker_429', count429, count5xx, windowSize };
    }
    if (count5xx >= max5xx) {
      return { aborted: true, reason: 'circuit_breaker_5xx', count429, count5xx, windowSize };
    }
    return { aborted: false, count429, count5xx, windowSize };
  }

  return { record };
}

module.exports = {
  createCircuitBreaker
};
