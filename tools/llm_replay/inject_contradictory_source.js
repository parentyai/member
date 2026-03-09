'use strict';

function injectContradictorySource(row) {
  const payload = row && typeof row === 'object' ? Object.assign({}, row) : {};
  payload.injected = 'contradictory_source';
  payload.sourceConflict = true;
  return payload;
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify({ ok: true, note: 'contradictory source injector ready' })}\n`);
}

module.exports = {
  injectContradictorySource
};
