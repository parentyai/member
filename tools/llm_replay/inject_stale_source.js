'use strict';

function injectStaleSource(row) {
  const payload = row && typeof row === 'object' ? Object.assign({}, row) : {};
  payload.injected = 'stale_source';
  payload.sourceFreshness = 'STALE';
  return payload;
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify({ ok: true, note: 'stale source injector ready' })}\n`);
}

module.exports = {
  injectStaleSource
};
