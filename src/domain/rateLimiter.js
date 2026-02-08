'use strict';

function createRateLimiter(options) {
  const opts = options || {};
  const rps = Number.isFinite(opts.rps) ? opts.rps : 0;
  const nowFn = typeof opts.nowFn === 'function' ? opts.nowFn : () => Date.now();
  const sleepFn = typeof opts.sleepFn === 'function'
    ? opts.sleepFn
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  if (!rps || rps <= 0) {
    return async () => {};
  }
  const intervalMs = 1000 / rps;
  let lastTime = 0;
  return async () => {
    const now = nowFn();
    const next = lastTime + intervalMs;
    if (now < next) {
      await sleepFn(Math.ceil(next - now));
      lastTime = next;
      return;
    }
    lastTime = now;
  };
}

module.exports = {
  createRateLimiter
};
